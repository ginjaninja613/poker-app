// frontend/screens/StartTournamentScreen.js
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKeepAwake } from 'expo-keep-awake';

function mmss(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(t / 60);
  const s = t % 60;
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(m)}:${pad(s)}`;
}

function levelDurationMinutes(lv) {
  // Support both durationMinutes (new) and duration (legacy)
  const val = typeof lv?.durationMinutes === 'number' ? lv.durationMinutes : lv?.duration;
  return typeof val === 'number' && val > 0 ? val : 20; // sensible default
}

function levelLabel(lv, idx) {
  if (lv?.isBreak) return `Break`;
  const n = lv?.level ?? idx + 1;
  const sb = lv?.smallBlind ?? 0;
  const bb = lv?.bigBlind ?? 0;
  const ante = lv?.ante ?? 0;
  return ante ? `Level ${n} — ${sb}/${bb}/${ante}` : `Level ${n} — ${sb}/${bb}`;
}

function nextBreakInfo(levels, currentIdx, msLeftInLevel) {
  if (!Array.isArray(levels) || levels.length === 0) return { inMs: null, breakIdx: null };
  let acc = msLeftInLevel;
  for (let i = currentIdx + 1; i < levels.length; i++) {
    const lv = levels[i];
    if (lv?.isBreak) {
      return { inMs: acc, breakIdx: i };
    }
    acc += levelDurationMinutes(lv) * 60 * 1000;
  }
  return { inMs: null, breakIdx: null };
}

export default function StartTournamentScreen({ route, navigation }) {
  useKeepAwake(); // prevent device sleep

  // Expect params from TournamentDetailScreen
  const { tournament, casinoName } = route.params || {};
  const tournamentId = tournament?._id || tournament?.id || tournament?.tournamentId || 'unknown';

  // Choose levels source (global structure OR per-day)
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const hasDays = Array.isArray(tournament?.days) && tournament.days.length > 0;

  const levels = useMemo(() => {
    if (hasDays) {
      const idx = Math.min(Math.max(0, selectedDayIndex), tournament.days.length - 1);
      return Array.isArray(tournament.days[idx]?.structure) ? tournament.days[idx].structure : [];
    }
    return Array.isArray(tournament?.structure) ? tournament.structure : [];
  }, [hasDays, selectedDayIndex, tournament]);

  // Core state
  const [status, setStatus] = useState('not_started'); // 'not_started' | 'running' | 'paused' | 'finished'
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
  const [millisLeft, setMillisLeft] = useState(
    levels.length ? levelDurationMinutes(levels[0]) * 60 * 1000 : 0
  );
  const [autoAdvance, setAutoAdvance] = useState(true);

  // Persist state key (per tournament+day)
  const storageKey = useMemo(
    () => `clock:${String(tournamentId)}:${hasDays ? selectedDayIndex : 0}`,
    [tournamentId, hasDays, selectedDayIndex]
  );

  // Load saved state (if any) when tournament/day changes
  useEffect(() => {
    let isCancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (isCancelled) return;

        // Only restore if structure length matches (simple safety)
        if (Array.isArray(levels) && levels.length > 0) {
          setStatus(saved.status ?? 'paused');
          const safeIdx =
            typeof saved.currentLevelIndex === 'number'
              ? Math.min(Math.max(0, saved.currentLevelIndex), levels.length - 1)
              : 0;
          setCurrentLevelIndex(safeIdx);

          const dur = levelDurationMinutes(levels[safeIdx]) * 60 * 1000;
          const ms = typeof saved.millisLeft === 'number' ? Math.min(Math.max(0, saved.millisLeft), dur) : dur;
          setMillisLeft(ms);

          setAutoAdvance(Boolean(saved.autoAdvance));
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Save on important changes
  useEffect(() => {
    (async () => {
      const toSave = {
        status,
        currentLevelIndex,
        millisLeft,
        autoAdvance,
        savedAt: Date.now(),
      };
      try {
        await AsyncStorage.setItem(storageKey, JSON.stringify(toSave));
      } catch {
        // ignore
      }
    })();
  }, [status, currentLevelIndex, millisLeft, autoAdvance, storageKey]);

  // Ticker
  const tickRef = useRef(null);
  useEffect(() => {
    if (status !== 'running') {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
      return;
    }
    tickRef.current = setInterval(() => {
      setMillisLeft((prev) => {
        const next = prev - 1000;
        if (next <= 0) {
          // End of level
          if (autoAdvance) {
            advanceLevel('next', true);
            return 0;
          } else {
            setStatus('paused');
            return 0;
          }
        }
        return next;
      });
    }, 1000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, autoAdvance, currentLevelIndex, levels]);

  // Helpers to move levels
  const setLevel = useCallback(
    (idx, preserveRunning = false) => {
      if (!Array.isArray(levels) || levels.length === 0) return;
      const clamped = Math.min(Math.max(0, idx), levels.length - 1);
      setCurrentLevelIndex(clamped);
      const ms = levelDurationMinutes(levels[clamped]) * 60 * 1000;
      setMillisLeft(ms);
      if (!preserveRunning) setStatus('paused'); // default to paused when jumping
    },
    [levels]
  );

  const advanceLevel = useCallback(
    (dir = 'next', fromAuto = false) => {
      if (!Array.isArray(levels) || levels.length === 0) return;
      let nextIdx = currentLevelIndex + (dir === 'prev' ? -1 : 1);
      if (nextIdx >= levels.length) {
        setStatus('finished');
        nextIdx = levels.length - 1;
      } else if (nextIdx < 0) {
        nextIdx = 0;
      }
      setCurrentLevelIndex(nextIdx);
      const ms = levelDurationMinutes(levels[nextIdx]) * 60 * 1000;
      setMillisLeft(ms);
      if (!fromAuto) setStatus('paused');
    },
    [currentLevelIndex, levels]
  );

  const addMinutes = useCallback((deltaMinutes) => {
    setMillisLeft((prev) => Math.max(0, prev + deltaMinutes * 60 * 1000));
  }, []);

  const setPresetTime = useCallback(() => {
    Alert.alert(
      'Set Time',
      'Choose a preset:',
      [
        { text: '5 minutes', onPress: () => setMillisLeft(5 * 60 * 1000) },
        { text: '10 minutes', onPress: () => setMillisLeft(10 * 60 * 1000) },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  }, []);

  // Derived
  const lv = levels[currentLevelIndex] || null;
  const durMs = lv ? levelDurationMinutes(lv) * 60 * 1000 : 0;
  const elapsed = durMs > 0 ? Math.min(1, 1 - millisLeft / durMs) : 0;

  const { inMs: nextBreakMs, breakIdx } = nextBreakInfo(levels, currentLevelIndex, millisLeft);
  const nextLabel =
    currentLevelIndex + 1 < levels.length
      ? levelLabel(levels[currentLevelIndex + 1], currentLevelIndex + 1)
      : '—';

  const upcoming = useMemo(() => {
    const arr = [];
    for (let i = currentLevelIndex + 1; i < Math.min(levels.length, currentLevelIndex + 1 + 4); i++) {
      arr.push({ idx: i, lv: levels[i] });
    }
    return arr;
  }, [levels, currentLevelIndex]);

  // Day selection change: reset to level 0 (paused)
  const changeDay = (newIdx) => {
    setSelectedDayIndex(newIdx);
    setStatus('paused');
    setCurrentLevelIndex(0);
    const firstDur = levels.length ? levelDurationMinutes(levels[0]) * 60 * 1000 : 0;
    setMillisLeft(firstDur);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <Text style={styles.title}>{tournament?.name || 'Tournament'}</Text>
      <Text style={styles.subtitle}>{casinoName || ''}</Text>

      {/* Day selector if multi-day */}
      {hasDays && (
        <View style={styles.dayPicker}>
          {tournament.days.map((d, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.dayChip, idx === selectedDayIndex && styles.dayChipActive]}
              onPress={() => changeDay(idx)}
            >
              <Text style={[styles.dayChipText, idx === selectedDayIndex && styles.dayChipTextActive]}>
                {d?.label || `Day ${idx + 1}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Big timer card */}
      <View style={[styles.timerCard, lv?.isBreak && styles.breakCard]}>
        <Text style={styles.timerBig}>{mmss(millisLeft)}</Text>
        <Text style={styles.levelLine}>
          {lv ? levelLabel(lv, currentLevelIndex) : 'No levels'}
        </Text>
        <Text style={styles.levelSub}>
          Length: {Math.round(durMs / 60000)} min
        </Text>

        {/* progress bar */}
        <View style={styles.barOuter}>
          <View style={[styles.barInner, { width: `${elapsed * 100}%` }]} />
        </View>
      </View>

      {/* Next / upcoming */}
      <View style={styles.infoRow}>
        <View style={styles.infoCol}>
          <Text style={styles.infoLabel}>Next break in</Text>
          <Text style={styles.infoValue}>
            {nextBreakMs != null ? mmss(nextBreakMs) : '—'}
          </Text>
        </View>
        <View style={styles.infoCol}>
          <Text style={styles.infoLabel}>Next level</Text>
          <Text style={styles.infoValue}>{nextLabel}</Text>
        </View>
      </View>

      <View style={styles.upcoming}>
        <Text style={styles.upcomingTitle}>Upcoming</Text>
        {upcoming.length === 0 ? (
          <Text style={styles.upcomingItem}>—</Text>
        ) : (
          upcoming.map((u) => (
            <Text key={u.idx} style={styles.upcomingItem}>
              {levelLabel(u.lv, u.idx)} • {levelDurationMinutes(u.lv)} min
            </Text>
          ))
        )}
      </View>

      {/* Status strip */}
      <View style={styles.statusStrip}>
        <Text style={styles.statusText}>
          {status === 'not_started' ? 'Not started' : status === 'running' ? 'Running' : status === 'paused' ? 'Paused' : 'Finished'}
        </Text>
        {hasDays && (
          <Text style={styles.statusText}>• {tournament.days[selectedDayIndex]?.label || `Day ${selectedDayIndex + 1}`}</Text>
        )}
        <Text style={styles.statusText}>• {new Date().toLocaleTimeString()}</Text>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {/* Start/Pause/Resume */}
        {status !== 'running' ? (
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => {
              if (levels.length === 0) return;
              if (status === 'not_started' || status === 'paused') setStatus('running');
              if (status === 'finished') {
                setLevel(0);
                setStatus('running');
              }
            }}
          >
            <Text style={styles.btnText}>{status === 'finished' ? 'Restart' : status === 'paused' ? 'Resume' : 'Start'}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.btn, styles.btnWarn]}
            onPress={() => setStatus('paused')}
          >
            <Text style={styles.btnText}>Pause</Text>
          </TouchableOpacity>
        )}

        {/* Prev/Next */}
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.btn, styles.btnGhost]}
            onPress={() =>
              Alert.alert('Previous level', 'Go to previous level?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Go', style: 'destructive', onPress: () => advanceLevel('prev') },
              ])
            }
          >
            <Text style={styles.btnText}>Prev</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnGhost]}
            onPress={() =>
              Alert.alert('Next level', 'Advance to next level?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Go', onPress: () => advanceLevel('next') },
              ])
            }
          >
            <Text style={styles.btnText}>Next</Text>
          </TouchableOpacity>
        </View>

        {/* Time adjust */}
        <View style={styles.row}>
          <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => addMinutes(1)}>
            <Text style={styles.btnText}>+1 min</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => addMinutes(-1)}>
            <Text style={styles.btnText}>-1 min</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={setPresetTime}>
            <Text style={styles.btnText}>Set time</Text>
          </TouchableOpacity>
        </View>

        {/* Auto-advance toggle */}
        <TouchableOpacity
          style={[styles.btn, autoAdvance ? styles.btnPrimary : styles.btnGhost]}
          onPress={() => setAutoAdvance((v) => !v)}
        >
          <Text style={styles.btnText}>Auto-advance: {autoAdvance ? 'ON' : 'OFF'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#6b7280', marginTop: -4 },
  dayPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#e5e7eb', borderRadius: 999 },
  dayChipActive: { backgroundColor: '#111827' },
  dayChipText: { color: '#111827', fontWeight: '700' },
  dayChipTextActive: { color: '#fff' },

  timerCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    alignItems: 'center',
    gap: 6,
  },
  breakCard: { backgroundColor: '#ecfdf5' },
  timerBig: { fontSize: 64, fontWeight: '900', letterSpacing: 2 },
  levelLine: { fontSize: 18, fontWeight: '700' },
  levelSub: { color: '#6b7280', marginBottom: 6 },
  barOuter: { height: 10, width: '100%', backgroundColor: '#e5e7eb', borderRadius: 999, overflow: 'hidden' },
  barInner: { height: '100%', backgroundColor: '#111827' },

  infoRow: { flexDirection: 'row', gap: 16 },
  infoCol: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, elevation: 1 },
  infoLabel: { color: '#6b7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6 },
  infoValue: { fontSize: 16, fontWeight: '700', marginTop: 4 },

  upcoming: { backgroundColor: '#fff', borderRadius: 12, padding: 12, elevation: 1 },
  upcomingTitle: { fontWeight: '800', marginBottom: 6 },
  upcomingItem: { color: '#111827', marginVertical: 2 },

  statusStrip: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'flex-start' },
  statusText: { color: '#6b7280' },

  controls: { gap: 10, marginTop: 8 },
  row: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnPrimary: { backgroundColor: '#111827' },
  btnWarn: { backgroundColor: '#b91c1c' },
  btnGhost: { backgroundColor: '#e5e7eb' },
  btnText: { color: '#fff', fontWeight: '800' },
});
