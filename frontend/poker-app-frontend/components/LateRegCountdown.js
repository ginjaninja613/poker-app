// frontend/poker-app-frontend/components/LateRegCountdown.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import theme from '../theme';

const API_BASE = 'http://192.168.0.178:5000';

function levelDurationMinutes(lv) {
  const val = typeof lv?.durationMinutes === 'number' ? lv.durationMinutes : lv?.duration;
  return typeof val === 'number' && val > 0 ? val : 20;
}
function pickLevels(tournament, dayIndex) {
  const hasDays = Array.isArray(tournament?.days) && tournament.days.length > 0;
  if (hasDays) {
    const idx = Math.min(Math.max(0, dayIndex | 0), tournament.days.length - 1);
    return Array.isArray(tournament.days[idx]?.structure) ? tournament.days[idx].structure : [];
  }
  return Array.isArray(tournament?.structure) ? tournament.structure : [];
}
function sumDurMs(levels, fromIdx, toIdxInclusive) {
  if (!Array.isArray(levels) || levels.length === 0) return 0;
  const start = Math.max(0, fromIdx | 0);
  const end = Math.min(levels.length - 1, toIdxInclusive | 0);
  let ms = 0;
  for (let i = start; i <= end; i++) {
    ms += levelDurationMinutes(levels[i]) * 60 * 1000;
  }
  return ms;
}
function toHMS(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
// index of Nth (1-based) playable level, skipping breaks
function indexOfNthPlayable(levels, n) {
  let count = 0;
  for (let i = 0; i < levels.length; i++) {
    if (!levels[i]?.isBreak) {
      count++;
      if (count === n) return i;
    }
  }
  return -1;
}

export default function LateRegCountdown({ tournament }) {
  const tournamentId = tournament?._id || tournament?.id || tournament?.tournamentId;
  const [live, setLive] = useState(null);
  const [remainingMs, setRemainingMs] = useState(null);

  async function fetchLive() {
    if (!tournamentId) return;
    try {
      const res = await fetch(`${API_BASE}/api/tournaments/${tournamentId}/live`);
      if (!res.ok) { setLive(null); return; }
      const data = await res.json();
      setLive(data || null);
    } catch {
      setLive(null);
    }
  }
  useEffect(() => {
    fetchLive();
    const i = setInterval(fetchLive, 3000);
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  // Compute where late reg closes:
  // If lateRegLevels = X, it closes at the end of the X-th NON-BREAK level.
  // If the next item after that playable level is a break, include the whole break.
  const closeInfo = useMemo(() => {
    const L = Number(tournament?.lateRegLevels ?? 0);
    if (!L || L <= 0) return null;

    const dayIndex = (live && typeof live.dayIndex === 'number') ? live.dayIndex : 0;
    const levels = pickLevels(tournament, dayIndex);
    if (!levels.length) return null;

    const lastPlayableIdx = indexOfNthPlayable(levels, L);
    if (lastPlayableIdx < 0) return null; // not enough playable levels

    const nextIdx = lastPlayableIdx + 1;
    const includeBreak = nextIdx < levels.length && !!levels[nextIdx]?.isBreak;
    const closeIdxEnd = includeBreak ? nextIdx : lastPlayableIdx;

    return { levels, dayIndex, lastPlayableIdx, includeBreak, closeIdxEnd };
  }, [tournament, live?.dayIndex]);

  useEffect(() => {
    if (!closeInfo) { setRemainingMs(null); return; }

    const { levels, closeIdxEnd } = closeInfo;

    function fromLive() {
      if (!live || typeof live.levelIndex !== 'number' || typeof live.remainingMs !== 'number') {
        return null;
      }
      const curIdx = live.levelIndex;
      const curLeft = Math.max(0, live.remainingMs);

      if (curIdx > closeIdxEnd) return 0; // already closed
      if (curIdx < closeIdxEnd) {
        const restAfterCurrent = sumDurMs(levels, curIdx + 1, closeIdxEnd);
        return curLeft + restAfterCurrent;
      }
      return curLeft; // curIdx === closeIdxEnd
    }

    function fromSchedule() {
      const startUTC = Array.isArray(tournament?.days) && tournament.days.length
        ? (tournament.days
            .map(d => new Date(d.startTimeUTC).getTime())
            .filter(n => !Number.isNaN(n))
            .sort((a,b)=>a-b)[0] ?? null)
        : (tournament?.dateTimeUTC ? new Date(tournament.dateTimeUTC).getTime() : null);
      if (!startUTC) return null;

      const now = Date.now();
      const msFromStartToClose = sumDurMs(levels, 0, closeIdxEnd);
      const closeAt = startUTC + msFromStartToClose;
      return Math.max(0, closeAt - now);
    }

    const liveMs = fromLive();
    const scheduledMs = fromSchedule();
    setRemainingMs(
      (liveMs === 0 || typeof liveMs === 'number') ? liveMs
      : (typeof scheduledMs === 'number' ? scheduledMs : null)
    );
  }, [tournament, live, closeInfo]);

  // local 1s tick for smooth UI
  const tickRef = useRef(null);
  useEffect(() => {
    if (remainingMs == null) return;
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setRemainingMs((prev) => (typeof prev === 'number' ? Math.max(0, prev - 1000) : prev));
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); tickRef.current = null; };
  }, [remainingMs]);

  if (!closeInfo || remainingMs == null) return null;

  const closed = remainingMs <= 0;
  return (
    <View style={[styles.card, closed && styles.closed]}>
      <Text style={styles.title}>Late Registration</Text>
      <Text style={[styles.value, closed && styles.closedText]}>
        {closed ? 'Closed' : `Closes in ${toHMS(remainingMs)}`}
      </Text>
      {/* (Removed the "Includes the next break" line earlier) */}
    </View>
  );
}

const styles = StyleSheet.create({
  // Transparent so it blends into green parent cards
  card: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  // Slight dim when closed, still on green
  closed: { borderColor: 'rgba(255,255,255,0.18)', opacity: 0.9 },

  title: { fontFamily: theme.fonts.heading, fontSize: 14, color: '#FFFFFF', marginBottom: 4 },
  value: { fontFamily: theme.fonts.heading, fontSize: 18, letterSpacing: 0.5, color: '#FFFFFF' },
  closedText: { color: 'rgba(255,255,255,0.85)' },
});
