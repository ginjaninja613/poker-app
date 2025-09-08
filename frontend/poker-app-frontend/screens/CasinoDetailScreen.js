// frontend/screens/CasinoDetailScreen.js
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';

const API_BASE = 'http://192.168.0.178:5000';

// Helper to safely extract an ID from various shapes
function getId(objOrId) {
  if (!objOrId) return '';
  if (typeof objOrId === 'string') return objOrId;
  return String(objOrId._id || objOrId.id || objOrId.casinoId || '');
}

// Compute "Scheduled in Xh" only if within 24h
function computeScheduledLabel(tournament) {
  const soonestUTC =
    Array.isArray(tournament?.days) && tournament.days.length
      ? tournament.days
          .map((d) => new Date(d.startTimeUTC).getTime())
          .filter((n) => !isNaN(n))
          .sort((a, b) => a - b)[0]
      : tournament?.dateTimeUTC
      ? new Date(tournament.dateTimeUTC).getTime()
      : null;
  if (!soonestUTC) return null;
  const now = Date.now();
  const dt = soonestUTC - now;
  if (dt > 0 && dt <= 24 * 60 * 60 * 1000) {
    const h = Math.floor(dt / (60 * 60 * 1000));
    return `Scheduled in ${h}h`;
  }
  return null;
}

export default function CasinoDetailScreen({ route, navigation }) {
  // Support either a full casino object or just { casinoId, casinoName }
  const { casino: casinoParam, casinoId: casinoIdParam, casinoName: casinoNameParam } = route.params || {};

  // Stable casino id (does NOT change when we call setData)
  const idToUse = useMemo(() => getId(casinoParam) || getId(casinoIdParam), [casinoParam, casinoIdParam]);

  const [data, setData] = useState(casinoParam || null); // prefer the object if provided
  const [tournaments, setTournaments] = useState([]); // separate state (not on casino)
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [assignedIds, setAssignedIds] = useState([]); // strings from /me

  // Live status map: { [tournamentId]: { status, levelIndex, remainingMs } }
  const [liveMap, setLiveMap] = useState({});

  const fetchCasino = async (id) => {
    if (!id) return casinoParam || null;
    const res = await fetch(`${API_BASE}/api/casinos/${id}`);
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : casinoParam || null;
    } catch {
      return casinoParam || null;
    }
  };

  const fetchTournaments = async (id) => {
    if (!id) return [];
    const res = await fetch(`${API_BASE}/api/casinos/${id}/tournaments`);
    const text = await res.text();
    try {
      const list = text ? JSON.parse(text) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  };

  const fetchMe = async () => {
    try {
      const cachedRole = await AsyncStorage.getItem('role');
      if (cachedRole) setUserRole(cachedRole);
      const token = await AsyncStorage.getItem('token');
      if (!token) return;
      const resMe = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const me = await resMe.json();
      if (resMe.ok && me) {
        setUserRole(me.role || null);
        setAssignedIds(Array.isArray(me.assignedCasinoIds) ? me.assignedCasinoIds.map(String) : []);
      }
    } catch {}
  };

  const fetchLiveStates = async (list) => {
    try {
      const pairs = await Promise.all(
        list.map(async (t) => {
          const id = t?._id || t?.id || t?.tournamentId;
          if (!id) return [null, null];
          try {
            const res = await fetch(`${API_BASE}/api/tournaments/${id}/live`);
            if (!res.ok) return [id, null];
            const data = await res.json();
            return [id, data || null];
          } catch {
            return [id, null];
          }
        })
      );
      const map = {};
      for (const [id, val] of pairs) {
        if (id) map[id] = val;
      }
      setLiveMap(map);
    } catch {}
  };

  // IMPORTANT: do NOT depend on `data` here; that caused the refresh loop.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      await fetchMe();

      if (!idToUse) {
        setData(casinoParam || null);
        setTournaments([]);
        return;
      }

      const updated = await fetchCasino(idToUse);
      setData(updated || casinoParam || null);

      const list = await fetchTournaments(idToUse);
      setTournaments(list);

      // fetch live statuses for the visible tournaments
      await fetchLiveStates(list);
    } catch (err) {
      console.warn('CasinoDetail load error:', err?.message);
      setTournaments([]);
      setLiveMap({});
    } finally {
      setLoading(false);
    }
  }, [idToUse, casinoParam]);

  useEffect(() => {
    load(); // initial load
    const unsubscribe = navigation.addListener('focus', load); // reload when screen regains focus
    return unsubscribe;
  }, [navigation, load]);

  const renderStatusPill = (t) => {
    const id = t?._id || t?.id || t?.tournamentId;
    const live = id ? liveMap[id] : null;

    const scheduled = !live?.status ? computeScheduledLabel(t) : null;

    if (live && live.status) {
      const label =
        live.status === 'running'
          ? 'Running'
          : live.status === 'paused'
          ? 'Paused'
          : live.status === 'completed'
          ? 'Completed'
          : '—';
      const textStyle =
        live.status === 'running'
          ? styles.pillTextRunning
          : live.status === 'paused'
          ? styles.pillTextPaused
          : styles.pillTextCompleted;

      return (
        <View style={[styles.pill, styles.pillWhite]}>
          <Text style={[styles.pillTextBase, textStyle]}>{label}</Text>
        </View>
      );
    }

    if (scheduled) {
      return (
        <View style={[styles.pill, styles.pillWhite]}>
          <Text style={[styles.pillTextBase, styles.pillTextScheduled]}>{scheduled}</Text>
        </View>
      );
    }

    return null;
  };

  const renderTournament = ({ item }) => (
    <TouchableOpacity
      style={styles.previewCard}
      activeOpacity={0.9}
      onPress={() =>
        navigation.navigate('TournamentDetail', {
          tournament: JSON.parse(JSON.stringify(item)),
          casinoName: data?.name || casinoNameParam || '',
          casinoId: idToUse,
        })
      }
    >
      <View style={styles.cardHeader}>
        <Text style={styles.title}>{item?.name || 'Tournament'}</Text>
        <View style={styles.cardHeaderRight}>
          {renderStatusPill(item)}
          <Ionicons name="chevron-forward" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
        </View>
      </View>

      <Text style={styles.line}>Buy-In: £{item?.buyIn ?? 0} + £{item?.rake ?? 0}</Text>
      <Text style={styles.line}>
        Start: {item?.dateTimeUTC ? new Date(item.dateTimeUTC).toLocaleString() : '—'}
      </Text>
      {typeof item?.prizePool === 'number' && <Text style={styles.line}>Prize Pool: £{item.prizePool}</Text>}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.muted}>Loading casino details...</Text>
      </View>
    );
  }

  const casinoIdStr = idToUse;
  const canAdd = userRole === 'admin' || (userRole === 'staff' && assignedIds.includes(String(casinoIdStr)));

  const dataSafe = data || {};
  const listSafe = Array.isArray(tournaments) ? tournaments : [];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerBox}>
        <Text style={styles.header}>{dataSafe.name || casinoNameParam || 'Casino'}</Text>
        <Text style={styles.address}>{typeof dataSafe.address === 'string' ? dataSafe.address : ''}</Text>
      </View>

      {canAdd && (
        <View style={styles.buttonWrapper}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('AddTournament', { casinoId: casinoIdStr })}
            activeOpacity={0.9}
          >
            <View style={styles.addButtonInner}>
              <Ionicons name="add" size={20} color="#111827" />
              <Text style={styles.addButtonText}>Add Tournament</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {listSafe.length === 0 ? (
        <Text style={styles.noTournaments}>No tournaments available.</Text>
      ) : (
        <FlatList
          data={listSafe}
          keyExtractor={(item, index) => item?._id ?? String(index)}
          renderItem={renderTournament}
          scrollEnabled={false}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: theme.colors.backgroundLight,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  muted: { marginTop: 8, color: theme.colors.grey, fontFamily: theme.fonts.body },

  headerBox: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    borderWidth: 1,
    borderColor: 'rgba(46,91,67,0.08)', // subtle green tint
  },
  header: {
    fontSize: 22,
    color: '#111827',
    marginBottom: 4,
    fontFamily: theme.fonts.heading, // Montserrat-Bold
  },
  address: {
    fontSize: 14,
    color: theme.colors.grey,
    fontFamily: theme.fonts.body, // Nunito-Regular
  },

  buttonWrapper: { marginBottom: 16 },
  addButton: {
    backgroundColor: theme.colors.accent, // GOLD to stand out from green cards
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  addButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#111827', // dark text on gold for readability
    fontSize: 16,
    marginLeft: 8,
    fontFamily: theme.fonts.heading,
  },

  noTournaments: {
    fontStyle: 'italic',
    color: theme.colors.grey,
    textAlign: 'center',
    marginTop: 20,
    fontFamily: theme.fonts.body,
  },

  // TOURNAMENT BUTTON (now green)
  previewCard: {
    backgroundColor: theme.colors.primary, // Gimmel green
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: theme.fonts.heading,
  },
  line: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.92)',
    fontFamily: theme.fonts.body,
  },

  // Status pills — white bg + status-colored text
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  pillWhite: {
    backgroundColor: '#FFFFFF',
  },
  pillTextBase: {
    fontSize: 12,
    fontFamily: theme.fonts.heading,
  },
  pillTextRunning: { color: theme.colors.primary },
  pillTextPaused: { color: theme.colors.accent },
  pillTextCompleted: { color: '#6b7280' },
  pillTextScheduled: { color: theme.colors.primary },
});
