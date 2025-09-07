// frontend/screens/StartTournamentScreen.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LiveClockService from '../services/LiveClockService';

const API_BASE = 'http://192.168.0.178:5000';

function mmss(ms) {
  const t = Math.max(0, Math.floor((ms || 0) / 1000));
  const m = Math.floor(t / 60);
  const s = t % 60;
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(m)}:${pad(s)}`;
}
function levelDurationMinutes(lv) {
  const val = typeof lv?.durationMinutes === 'number' ? lv.durationMinutes : lv?.duration;
  return typeof val === 'number' && val > 0 ? val : 20;
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
    if (lv?.isBreak) return { inMs: acc, breakIdx: i };
    acc += levelDurationMinutes(lv) * 60 * 1000;
  }
  return { inMs: null, breakIdx: null };
}

export default function StartTournamentScreen({ route }) {
  useKeepAwake(); // prevent device sleep

  const { tournament, casinoName, readOnly } = route.params || {};
  const [snap, setSnap] = useState(LiveClockService.getState());

  // Initialize service and subscribe (do NOT stop on unmount)
  useEffect(() => {
    LiveClockService.init({ tournament, dayIndex: snap.dayIndex ?? 0 });
    const unsub = LiveClockService.subscribe(setSnap);
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournament?._id]);

  // Convenience
  const levels = snap.levels || [];
  const hasDays = Array.isArray(tournament?.days) && tournament.days.length > 0;

  // Derived UI
  const lv = levels[snap.currentLevelIndex || 0] || null;
  const durMs = lv ? levelDurationMinutes(lv) * 60 * 1000 : 0;
  const elapsed = durMs > 0 ? Math.min(1, 1 - (snap.remainingMs || 0) / durMs) : 0;

  const { inMs: nextBreakMs } = nextBreakInfo(
    levels,
    snap.currentLevelIndex || 0,
    snap.remainingMs || 0
  );
  const nextLabel =
    (snap.currentLevelIndex || 0) + 1 < levels.length
      ? levelLabel(levels[(snap.currentLevelIndex || 0) + 1], (snap.currentLevelIndex || 0) + 1)
      : '—';

  const upcoming = useMemo(() => {
    const arr = [];
    const start = (snap.currentLevelIndex || 0) + 1;
    for (let i = start; i < Math.min(levels.length, start + 4); i++) {
      arr.push({ idx: i, lv: levels[i] });
    }
    return arr;
  }, [levels, snap.currentLevelIndex]);

  const onChangeDay = (idx) => {
    LiveClockService.setDay(idx);
  };

  // ---- Minimal backend sync for Live State (safe to keep even before backend route exists) ----
  useEffect(() => {
    let cancelled = false;
    const send = async () => {
      try {
        const tournamentId = tournament?._id || tournament?.id || tournament?.tournamentId;
        if (!tournamentId) return;
        const token = await AsyncStorage.getItem('token');
        const payload = {
          status:
            snap.status === 'finished' ? 'completed'
            : snap.status === 'running' ? 'running'
            : 'paused', // 'not_started' maps to 'paused'
          dayIndex: snap.dayIndex ?? 0,
          levelIndex: snap.currentLevelIndex ?? 0,
          remainingMs: snap.remainingMs ?? 0,
          totalLevels: levels.length,
          dayLabel: hasDays ? (tournament.days[snap.dayIndex ?? 0]?.label || `Day ${(snap.dayIndex ?? 0)+1}`) : 'Main',
        };
        await fetch(`${API_BASE}/api/tournaments/${tournamentId}/live`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        }).catch(() => {});
      } catch {}
    };
    // Throttle a little: send after small delay to batch rapid changes
    const t = setTimeout(() => { if (!cancelled) send(); }, 800);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.status, snap.currentLevelIndex, snap.remainingMs, snap.dayIndex]);

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
              style={[styles.dayChip, idx === (snap.dayIndex ?? 0) && styles.dayChipActive]}
              onPress={() => onChangeDay(idx)}
              disabled={!!readOnly}
            >
              <Text
                style={[
                  styles.dayChipText,
                  idx === (snap.dayIndex ?? 0) && styles.dayChipTextActive,
                ]}
              >
                {d?.label || `Day ${idx + 1}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Big timer card */}
      <View style={[styles.timerCard, lv?.isBreak && styles.breakCard]}>
        <Text style={styles.timerBig}>{mmss(snap.remainingMs || 0)}</Text>
        <Text style={styles.levelLine}>
          {lv ? levelLabel(lv, snap.currentLevelIndex || 0) : 'No levels'}
        </Text>
        <Text style={styles.levelSub}>Length: {Math.round(durMs / 60000)} min</Text>

        {/* progress bar */}
        <View style={styles.barOuter}>
          <View style={[styles.barInner, { width: `${elapsed * 100}%` }]} />
        </View>
      </View>

      {/* Next / upcoming */}
      <View style={styles.infoRow}>
        <View style={styles.infoCol}>
          <Text style={styles.infoLabel}>Next break in</Text>
          <Text style={styles.infoValue}>{nextBreakMs != null ? mmss(nextBreakMs) : '—'}</Text>
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
          {snap.status === 'not_started'
            ? 'Not started'
            : snap.status === 'running'
            ? 'Running'
            : snap.status === 'paused'
            ? 'Paused'
            : 'Finished'}
        </Text>
        {hasDays && (
          <Text style={styles.statusText}>
            • {tournament.days[snap.dayIndex ?? 0]?.label || `Day ${(snap.dayIndex ?? 0) + 1}`}
          </Text>
        )}
        <Text style={styles.statusText}>• {new Date().toLocaleTimeString()}</Text>
      </View>

      {/* Controls (hidden/disabled in readOnly mode) */}
      {!readOnly ? (
        <View style={styles.controls}>
          {/* Start/Pause/Resume */}
          {snap.status !== 'running' ? (
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={() => LiveClockService.startOrResume()}
            >
              <Text style={styles.btnText}>
                {snap.status === 'finished' ? 'Restart' : snap.status === 'paused' ? 'Resume' : 'Start'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.btn, styles.btnWarn]}
              onPress={() => LiveClockService.pause()}
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
                  { text: 'Go', style: 'destructive', onPress: () => LiveClockService.prevLevel() },
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
                  { text: 'Go', onPress: () => LiveClockService.nextLevel() },
                ])
              }
            >
              <Text style={styles.btnText}>Next</Text>
            </TouchableOpacity>
          </View>

          {/* Time adjust */}
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.btn, styles.btnGhost]}
              onPress={() => LiveClockService.addMinutes(1)}
            >
              <Text style={styles.btnText}>+1 min</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnGhost]}
              onPress={() => LiveClockService.addMinutes(-1)}
            >
              <Text style={styles.btnText}>-1 min</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnGhost]}
              onPress={() =>
                Alert.alert('Set Time', 'Choose a preset:', [
                  { text: '5 minutes', onPress: () => LiveClockService.setPresetMs(5 * 60 * 1000) },
                  { text: '10 minutes', onPress: () => LiveClockService.setPresetMs(10 * 60 * 1000) },
                  { text: 'Cancel', style: 'cancel' },
                ])
              }
            >
              <Text style={styles.btnText}>Set time</Text>
            </TouchableOpacity>
          </View>

          {/* Auto-advance toggle */}
          <TouchableOpacity
            style={[styles.btn, snap.autoAdvance ? styles.btnPrimary : styles.btnGhost]}
            onPress={() => LiveClockService.setAutoAdvance(!snap.autoAdvance)}
          >
            <Text style={styles.btnText}>Auto-advance: {snap.autoAdvance ? 'ON' : 'OFF'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.readOnlyBanner]}>
          <Text style={{ color: '#111827', fontWeight: '700' }}>
            View-only mode — controls disabled
          </Text>
        </View>
      )}
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

  readOnlyBanner: {
    backgroundColor: '#fde68a',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
});
