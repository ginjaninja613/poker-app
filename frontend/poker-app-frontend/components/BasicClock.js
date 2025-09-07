// frontend/components/BasicClock.js
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

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
  if (lv?.isBreak) return 'Break';
  const n = lv?.level ?? idx + 1;
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

export default function BasicClock({ tournament, onPress }) {
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
    const lvlText = lv ? levelLabel(lv, live.levelIndex ?? 0) : 'Level —';
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
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.status}>{statusText}</Text>
        <Text style={styles.timer}>{timeText}</Text>
      </View>
      <Text style={styles.level}>{label}</Text>
      {!!err && <Text style={styles.err}>⚠ {String(err)}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  status: { fontWeight: '800', color: '#111827' },
  timer: { fontWeight: '900', fontSize: 20, letterSpacing: 1 },
  level: { marginTop: 4, color: '#374151' },
  err: { marginTop: 6, color: '#b91c1c' },
});
