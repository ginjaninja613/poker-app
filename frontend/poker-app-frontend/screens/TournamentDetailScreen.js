// frontend/poker-app-frontend/screens/TournamentDetailScreen.js
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import BasicClock from '../components/BasicClock';
import LateRegCountdown from '../components/LateRegCountdown'; // countdown card
import theme from '../theme';

const API_BASE = 'http://192.168.0.178:5000';

// Number only playable (non-break) levels
function playableNumberAt(levels, idx) {
  let count = 0;
  for (let i = 0; i <= idx; i++) {
    if (!levels[i]?.isBreak) count++;
  }
  return count;
}

// Compute "Scheduled in Xh" if within 24h
function computeScheduledLabel(tournament) {
  const days = Array.isArray(tournament?.days) ? tournament.days : [];
  const times = [];

  if (days.length) {
    for (const d of days) {
      const t = new Date(d?.startTimeUTC).getTime();
      if (!isNaN(t)) times.push(t);
    }
  }
  const single = tournament?.dateTimeUTC ? new Date(tournament.dateTimeUTC).getTime() : null;
  if (typeof single === 'number' && !isNaN(single)) times.push(single);

  if (!times.length) return null;
  times.sort((a, b) => a - b);

  const soonestUTC = times[0];
  const now = Date.now();
  const dt = soonestUTC - now;
  if (dt > 0 && dt <= 24 * 60 * 60 * 1000) {
    const h = Math.floor(dt / (60 * 60 * 1000));
    return `Scheduled in ${h}h`;
  }
  return null;
}

export default function TournamentDetailScreen({ route, navigation }) {
  const { tournament: initialTournament, casinoName, casinoId } = route.params;
  const [tournament, setTournament] = useState(initialTournament || {});
  const [canEdit, setCanEdit] = useState(false);
  const [live, setLive] = useState(null); // live state for button label

  // NEW: day structure dropdown state
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  const structure = Array.isArray(tournament?.structure) ? tournament.structure : [];
  const days = Array.isArray(tournament?.days) ? tournament.days : [];

  // permissions
  useEffect(() => {
    (async () => {
      const cachedRole = await AsyncStorage.getItem('role');
      if (cachedRole === 'admin' || cachedRole === 'staff') setCanEdit(true);

      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) return;
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const me = await res.json();
        if (!res.ok) return;

        const assigned = Array.isArray(me.assignedCasinoIds) ? me.assignedCasinoIds.map(String) : [];
        const hasAccess = me.role === 'admin' || (me.role === 'staff' && assigned.includes(String(casinoId)));
        setCanEdit(hasAccess);
      } catch {
        // ignore
      }
    })();
  }, [casinoId]);

  const parseJson = async (res) => {
    const t = await res.text();
    try { return t ? JSON.parse(t) : {}; } catch { throw new Error('Invalid JSON'); }
  };

  // refresh tournament data when focused
  useFocusEffect(
    useCallback(() => {
      const fetchTournament = async () => {
        try {
          const res = await fetch(`${API_BASE}/api/tournaments/${tournament._id}`);
          const updated = await parseJson(res);
          if (!res.ok) throw new Error(updated?.error || 'Failed to reload tournament');
          setTournament(updated);
        } catch (err) {
          console.error('🔄 Error refreshing tournament:', err.message);
        }
      };
      if (tournament?._id) fetchTournament();
    }, [tournament?._id])
  );

  // poll live state for dynamic button title
  useEffect(() => {
    let cancelled = false;
    let timer = null;

    async function fetchLive() {
      if (!tournament?._id) return;
      try {
        const res = await fetch(`${API_BASE}/api/tournaments/${tournament._id}/live`);
        if (!res.ok) {
          if (!cancelled) setLive(null);
          return;
        }
        const data = await res.json();
        if (!cancelled) setLive(data || null);
      } catch {
        if (!cancelled) setLive(null);
      }
    }

    fetchLive();
    timer = setInterval(fetchLive, 3000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [tournament?._id]);

  const handleDelete = () => {
    Alert.alert('Confirm Delete', 'Delete this tournament?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem('token');
            const res = await fetch(
              `${API_BASE}/api/casinos/${casinoId}/tournaments/${tournament._id}`,
              { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
            );
            const data = await parseJson(res);
            if (!res.ok) throw new Error(data?.error || 'Delete failed');
            Alert.alert('Success', 'Tournament deleted');
            navigation.goBack();
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  const renderStructureTable = (levels) => {
    if (!Array.isArray(levels) || levels.length === 0) return null;
    return (
      <View style={styles.structureBox}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCell, styles.headerCell, { flex: 1.3 }]}>Level</Text>
          <Text style={[styles.tableCell, styles.headerCell]}>SB</Text>
          <Text style={[styles.tableCell, styles.headerCell]}>BB</Text>
          <Text style={[styles.tableCell, styles.headerCell]}>Ante</Text>
          <Text style={[styles.tableCell, styles.headerCell]}>Duration</Text>
        </View>
        {levels.map((entry, idx) => {
          const isBreak = !!entry?.isBreak;
          const lvlText = isBreak ? 'Break' : `Level ${playableNumberAt(levels, idx)}`;
          const zebra = idx % 2 === 1;
          return (
            <View
              key={idx}
              style={[
                styles.tableRow,
                zebra && styles.tableRowAlt,
                isBreak && styles.breakRow,
              ]}
            >
              <Text style={[styles.tableCell, isBreak && styles.breakCell, { flex: 1.3 }]}>
                {lvlText}
              </Text>
              {isBreak ? (
                <>
                  <Text style={styles.tableCell}>–</Text>
                  <Text style={styles.tableCell}>–</Text>
                  <Text style={styles.tableCell}>–</Text>
                  <Text style={styles.tableCell}>
                    {entry?.durationMinutes != null ? `${entry.durationMinutes} min` : '—'}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.tableCell}>{entry?.smallBlind ?? '—'}</Text>
                  <Text style={styles.tableCell}>{entry?.bigBlind ?? '—'}</Text>
                  <Text style={styles.tableCell}>{entry?.ante ?? '—'}</Text>
                  <Text style={styles.tableCell}>
                    {entry?.durationMinutes != null ? `${entry.durationMinutes} min` : '—'}
                  </Text>
                </>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  // button title based on live state
  const started = !!(live && (live.status === 'running' || live.status === 'paused' || live.status === 'completed'));
  const startBtnTitle = started ? 'View Clock' : 'Start Tournament';

  // Re-entry display
  const reEntryUnlimited = !!tournament?.reEntryUnlimited;
  const reEntryCount = Number(tournament?.reEntryCount ?? 0);
  const reEntryAllowed = !!tournament?.reEntry || reEntryUnlimited || reEntryCount > 0;
  let reEntryText = 'Freezeout';
  if (reEntryUnlimited) reEntryText = 'Unlimited';
  else if (reEntryAllowed && reEntryCount > 0) reEntryText = `Max ${reEntryCount}`;

  const lateRegLevels = Number(tournament?.lateRegLevels ?? 0);

  // Status pill text + color
  const scheduledLabel = computeScheduledLabel(tournament);
  let pillText = null;
  let pillTextStyle = null;
  if (live?.status === 'running') {
    pillText = 'Running';
    pillTextStyle = styles.pillTextRunning;
  } else if (live?.status === 'paused') {
    pillText = 'Paused';
    pillTextStyle = styles.pillTextPaused;
  } else if (live?.status === 'completed') {
    pillText = 'Completed';
    pillTextStyle = styles.pillTextCompleted;
  } else if (scheduledLabel) {
    pillText = scheduledLabel;
    pillTextStyle = styles.pillTextScheduled;
  }

  // Chips per rules
  const reEntryChipLabel = reEntryText === 'Freezeout' ? 'Freezeout' : `Re-Entry: ${reEntryText}`;
  const lateRegChipLabel =
    lateRegLevels > 0 ? `Late Reg: ${lateRegLevels} level${lateRegLevels === 1 ? '' : 's'} + breaks` : null;

  // NEW: day-derived helpers (for dropdown + structure render)
  const sortedDays = useMemo(() => {
    const d = Array.isArray(days) ? [...days] : [];
    d.sort((a, b) => new Date(a.startTimeUTC) - new Date(b.startTimeUTC));
    return d;
  }, [days]);

  const selectedDay = sortedDays[selectedDayIndex] || null;
  const selectedDayStructure = Array.isArray(selectedDay?.structure) ? selectedDay.structure : [];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* HERO (white) */}
      <View style={styles.hero}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle}>{tournament?.name || 'Tournament'}</Text>
          <Text style={styles.heroSub}>@ {casinoName || ''}</Text>
        </View>
        {pillText ? (
          <View style={[styles.pill, styles.pillWhite]}>
            <Text style={[styles.pillTextBase, pillTextStyle]}>{pillText}</Text>
          </View>
        ) : null}
      </View>

      {/* CLOCK (green) with chevron */}
      <TouchableOpacity
        activeOpacity={0.9}
        style={[styles.cardGreen, styles.clickableCard]}
        onPress={() =>
          navigation.navigate('StartTournament', {
            tournament,
            casinoName,
            readOnly: !canEdit,
          })
        }
      >
        <BasicClock tournament={tournament} onPress={() =>
          navigation.navigate('StartTournament', { tournament, casinoName, readOnly: !canEdit })
        } />
        <Ionicons name="chevron-forward" size={20} color="#fff" style={styles.chevron} />
      </TouchableOpacity>

      {/* LATE REG COUNTDOWN (green) */}
      <View style={styles.cardGreen}>
        <LateRegCountdown tournament={tournament} />
      </View>

      {/* OVERVIEW (green) — now includes Bounty when > 0 */}
      <View style={styles.cardGreen}>
        <Text style={styles.sectionTitleLight}>Overview</Text>
        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabelLight}>Buy-In</Text>
            <Text style={styles.gridValueLight}>£{tournament?.buyIn ?? 0}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabelLight}>Rake</Text>
            <Text style={styles.gridValueLight}>£{tournament?.rake ?? 0}</Text>
          </View>
          {!!tournament?.prizePool && (
            <View style={styles.gridItem}>
              <Text style={styles.gridLabelLight}>Prize Pool</Text>
              <Text style={styles.gridValueLight}>£{tournament.prizePool}</Text>
            </View>
          )}
          {!!tournament?.startingStack && (
            <View style={styles.gridItem}>
              <Text style={styles.gridLabelLight}>Starting Stack</Text>
              <Text style={styles.gridValueLight}>{tournament.startingStack}</Text>
            </View>
          )}
          {!!tournament?.bounty && Number(tournament.bounty) > 0 && (
            <View style={styles.gridItem}>
              <Text style={styles.gridLabelLight}>Bounty</Text>
              <Text style={styles.gridValueLight}>£{Number(tournament.bounty)}</Text>
            </View>
          )}
          <View style={styles.gridItem}>
            <Text style={styles.gridLabelLight}>Game</Text>
            <Text style={styles.gridValueLight}>{tournament?.gameType || 'No Limit Hold’em'}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabelLight}>Start</Text>
            <Text style={styles.gridValueLight}>
              {tournament?.dateTimeUTC ? new Date(tournament.dateTimeUTC).toLocaleString() : '—'}
            </Text>
          </View>
        </View>

        {/* CHIPS */}
        <View style={styles.chipsRow}>
          <View style={styles.chipWhite}>
            <Ionicons name="repeat" size={14} color={theme.colors.primary} />
            <Text style={styles.chipTextGreen}>{reEntryChipLabel}</Text>
          </View>
          {lateRegChipLabel && (
            <View style={styles.chipWhite}>
              <Ionicons name="time-outline" size={14} color={theme.colors.primary} />
              <Text style={styles.chipTextGreen}>{lateRegChipLabel}</Text>
            </View>
          )}
        </View>
      </View>

      {/* SCHEDULE (green) */}
      {sortedDays.length > 0 && (
        <View style={styles.cardGreen}>
          <Text style={styles.sectionTitleLight}>Schedule</Text>
          {sortedDays.map((d, i) => (
            <View key={i} style={styles.dayRow}>
              <Text style={styles.dayTitleLight}>{d.label || `Day ${i + 1}`}</Text>
              <Text style={styles.daySubLight}>{new Date(d.startTimeUTC).toLocaleString()}</Text>
            </View>
          ))}
        </View>
      )}

      {/* STRUCTURE (green) with Day dropdown if multi-day */}
      <View style={styles.cardGreen}>
        <View style={styles.structureHeaderRow}>
          <Text style={styles.sectionTitleLight}>Structure</Text>

          {sortedDays.length > 0 && (
            <View style={{ position: 'relative' }}>
              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.daySelector}
                onPress={() => setDayPickerOpen((v) => !v)}
              >
                <Text style={styles.daySelectorLabel}>
                  {sortedDays[selectedDayIndex]?.label || `Day ${selectedDayIndex + 1}`}
                </Text>
                <Ionicons
                  name={dayPickerOpen ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={theme.colors.primary}
                />
              </TouchableOpacity>

              {dayPickerOpen && (
                <View style={styles.dropdown}>
                  {sortedDays.map((d, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setSelectedDayIndex(i);
                        setDayPickerOpen(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>
                        {d.label || `Day ${i + 1}`}
                      </Text>
                      {i === selectedDayIndex && (
                        <Ionicons name="checkmark" size={16} color={theme.colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.tableWrapOnGreen}>
          {sortedDays.length > 0
            ? renderStructureTable(selectedDayStructure)
            : renderStructureTable(structure)}
        </View>
      </View>

      {/* ACTION BAR (green) */}
      {canEdit && (
        <View style={styles.actionsCardGreen}>
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.9}
            onPress={() =>
              navigation.navigate('StartTournament', {
                tournament,
                casinoName,
                readOnly: false,
              })
            }
          >
            <Text style={styles.primaryButtonText}>{startBtnTitle}</Text>
            <Ionicons name="chevron-forward" size={18} color="#fff" style={{ marginLeft: 6 }} />
          </TouchableOpacity>

          <View style={{ height: 12 }} />

          <View style={styles.rowSplit}>
            <TouchableOpacity
              style={styles.secondaryButtonLight}
              activeOpacity={0.9}
              onPress={() =>
                navigation.navigate('EditTournament', { tournamentId: tournament._id, casinoId })
              }
            >
              <Ionicons name="create-outline" size={18} color={theme.colors.primary} />
              <Text style={styles.secondaryButtonTextLight}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.dangerButton} activeOpacity={0.9} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={18} color="#fff" />
              <Text style={styles.dangerButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: theme.colors.backgroundLight },

  // HERO (white)
  hero: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(46,91,67,0.08)',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroTitle: { fontSize: 22, color: '#111827', fontFamily: theme.fonts.heading },
  heroSub: { marginTop: 2, fontSize: 14, color: theme.colors.grey, fontFamily: theme.fonts.body },

  // Generic GREEN card
  cardGreen: {
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    position: 'relative',
  },
  clickableCard: { paddingRight: 36 },
  chevron: { position: 'absolute', right: 12, top: 12 },

  sectionTitleLight: { fontSize: 16, color: '#fff', marginBottom: 10, fontFamily: theme.fonts.heading },

  // Overview grid (on green)
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: { width: '50%', paddingVertical: 8, paddingRight: 8 },
  gridLabelLight: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginBottom: 2, fontFamily: theme.fonts.body },
  gridValueLight: { fontSize: 16, color: '#fff', fontFamily: theme.fonts.heading },

  // Chips on green — white chip w/ green text
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chipWhite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  chipTextGreen: { color: theme.colors.primary, fontFamily: theme.fonts.body, fontSize: 13 },

  // Schedule
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  dayTitleLight: { fontSize: 15, color: '#fff', fontFamily: theme.fonts.heading },
  daySubLight: { fontSize: 13, color: 'rgba(255,255,255,0.9)', fontFamily: theme.fonts.body },

  // Structure header + dropdown
  structureHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  daySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  daySelectorLabel: { color: theme.colors.primary, fontFamily: theme.fonts.heading, fontSize: 13 },

  dropdown: {
    position: 'absolute',
    top: 44,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 6,
    minWidth: 160,
    borderWidth: 1,
    borderColor: 'rgba(46,91,67,0.25)',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 50,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownItemText: { color: '#111827', fontFamily: theme.fonts.body, fontSize: 14 },

  // Structure table inside green card (kept readable)
  tableWrapOnGreen: { backgroundColor: 'transparent' },
  structureBox: { marginTop: 6, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 8,
  },
  tableRow: { flexDirection: 'row', paddingVertical: 8, backgroundColor: 'rgba(0,0,0,0.04)' },
  tableRowAlt: { backgroundColor: 'rgba(255,255,255,0.06)' },
  tableCell: { flex: 1, fontSize: 13, textAlign: 'center', color: '#fff', fontFamily: theme.fonts.body },
  headerCell: { fontFamily: theme.fonts.heading, color: '#fff' },
  breakRow: { backgroundColor: 'rgba(212,175,55,0.12)' },
  breakCell: { color: '#fff', fontFamily: theme.fonts.heading },

  // Actions (green)
  actionsCardGreen: {
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    padding: 16,
    marginTop: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  rowSplit: { flexDirection: 'row', justifyContent: 'space-between' },

  primaryButton: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontFamily: theme.fonts.heading },

  secondaryButtonLight: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(46,91,67,0.25)',
    flex: 1,
    marginRight: 8,
    justifyContent: 'center',
  },
  secondaryButtonTextLight: { color: theme.colors.primary, fontSize: 16, marginLeft: 6, fontFamily: theme.fonts.heading },

  dangerButton: {
    backgroundColor: '#b91c1c',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 8,
    justifyContent: 'center',
  },
  dangerButtonText: { color: '#fff', fontSize: 16, marginLeft: 6, fontFamily: theme.fonts.heading },

  // Status pill — white bg with status-colored text
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  pillWhite: { backgroundColor: '#FFFFFF' },
  pillTextBase: { fontSize: 12, fontFamily: theme.fonts.heading },
  pillTextRunning: { color: theme.colors.primary },
  pillTextPaused: { color: theme.colors.accent },
  pillTextCompleted: { color: '#6b7280' },
  pillTextScheduled: { color: theme.colors.primary },
});
