// frontend/components/BasicClock.js
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';

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
// playable numbering helper
function playableNumberAt(levels, idx) {
  let count = 0;
  for (let i = 0; i <= idx; i++) {
    if (!levels[i]?.isBreak) count++;
  }
  return count;
}
// use playable numbering in label
function levelLabel(lv, idx, allLevels) {
  if (lv?.isBreak) return 'Break';
  const n = Array.isArray(allLevels) ? playableNumberAt(allLevels, idx) : (lv?.level ?? idx + 1);
  const sb = lv?.smallBlind ?? 0;
  const bb = lv?.bigBlind ?? 0;
  const ante = lv?.ante ?? 0;
  return ante ? `Level ${n} — ${sb}/${bb}/${ante}` : `Level ${n} — ${sb}/${bb}`;
}
function pickLevels(tournament, dayIndex) {
  const hasDays = Array.isArray(tournament?.days) && tournament.days.length > 0;
  if (hasDays) {
    const idx = Math.min(Math.max(0, dayIndex | 0), tournament.days.length - 1);
    return Array.isArray(tournament.days[idx]?.structure) ? tournament.days[idx].structure : [];
  }
  return Array.isArray(tournament?.structure) ? tournament.structure : [];
}

export default function BasicClock({ tournament, onPress, showChevron = false }) {
  const [live, setLive] = useState(null);
  const [err, setErr] = useState(null);

  const tournamentId = tournament?._id || tournament?.id || tournament?.tournamentId;

  async function fetchLive() {
    if (!tournamentId) return;
    try {
      const res = await fetch(`${API_BASE}/api/tournaments/${tournamentId}/live`);
      if (!res.ok) {
        setLive(null); // gracefully fallback to scheduled
        return;
      }
      const data = await res.json();
      setLive(data || null);
    } catch (e) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    fetchLive();                 // initial
    const i = setInterval(fetchLive, 3000); // simple polling
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  // derive display
  const { label, timeText, statusText } = useMemo(() => {
    // scheduled in <24h
    const soonestUTC = Array.isArray(tournament?.days) && tournament.days.length
      ? tournament.days
          .map(d => new Date(d.startTimeUTC).getTime())
          .filter(n => !isNaN(n))
          .sort((a,b)=>a-b)[0]
      : (tournament?.dateTimeUTC ? new Date(tournament.dateTimeUTC).getTime() : null);

    if (!live) {
      if (soonestUTC) {
        const now = Date.now();
        const dt = soonestUTC - now;
        if (dt > 0 && dt <= 24 * 60 * 60 * 1000) {
          const h = Math.floor(dt / (60 * 60 * 1000));
          const m = Math.floor((dt % (60 * 60 * 1000)) / (60 * 1000));
          return { label: 'Scheduled', timeText: `Starts in ${h}h ${m}m`, statusText: 'Scheduled' };
        }
      }
      return { label: '—', timeText: 'No live clock', statusText: '—' };
    }

    // live present
    const levels = pickLevels(tournament, live.dayIndex ?? 0);
    const lv = levels[live.levelIndex ?? 0] || null;
    const lvlText = lv ? levelLabel(lv, live.levelIndex ?? 0, levels) : 'Level —';
    const status = (live.status === 'completed') ? 'Completed'
                  : (live.status === 'running') ? 'Running'
                  : (live.status === 'paused') ? 'Paused'
                  : '—';
    return {
      label: lvlText,
      timeText: mmss(live.remainingMs ?? 0),
      statusText: status,
    };
  }, [live, tournament]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.status}>{statusText}</Text>
        <Text style={styles.timer}>{timeText}</Text>
      </View>

      <Text style={styles.level}>{label}</Text>

      {showChevron && (
        <Ionicons name="chevron-forward" size={20} color="#FFFFFF" style={styles.chevron} />
      )}

      {!!err && <Text style={styles.err}>⚠ {String(err)}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Transparent + bordered so it drops onto green cards nicely
  wrap: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    position: 'relative',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  // Typography (white to contrast green background)
  status: { fontFamily: theme.fonts.heading, color: '#FFFFFF' },
  timer: { fontFamily: theme.fonts.heading, fontSize: 20, letterSpacing: 1, color: '#FFFFFF' },
  level: { marginTop: 4, color: 'rgba(255,255,255,0.92)', fontFamily: theme.fonts.body },

  // Errors (keep readable on green)
  err: { marginTop: 6, color: '#FFE4E6', fontFamily: theme.fonts.body },

  // Optional chevron
  chevron: { position: 'absolute', right: 10, top: 10 },
});
