// frontend/screens/CasinoDetailScreen.js
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Button,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = 'http://192.168.0.178:5000';

// Helper to safely extract an ID from various shapes
function getId(objOrId) {
  if (!objOrId) return '';
  if (typeof objOrId === 'string') return objOrId;
  return String(objOrId._id || objOrId.id || objOrId.casinoId || '');
}

export default function CasinoDetailScreen({ route, navigation }) {
  // Support either a full casino object or just { casinoId, casinoName }
  const { casino: casinoParam, casinoId: casinoIdParam, casinoName: casinoNameParam } = route.params || {};

  // Stable casino id (does NOT change when we call setData)
  const idToUse = useMemo(
    () => getId(casinoParam) || getId(casinoIdParam),
    [casinoParam, casinoIdParam]
  );

  const [data, setData] = useState(casinoParam || null); // prefer the object if provided
  const [tournaments, setTournaments] = useState([]); // separate state (not on casino)
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [assignedIds, setAssignedIds] = useState([]); // strings from /me

  const fetchCasino = async (id) => {
    if (!id) return casinoParam || null;
    const res = await fetch(`${API_BASE}/api/casinos/${id}`);
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : (casinoParam || null);
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
      // Fallback: read cached role (non-authoritative)
      const cachedRole = await AsyncStorage.getItem('role');
      if (cachedRole) setUserRole(cachedRole);

      // Authoritative: ask backend who we are
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
    } catch {
      // ignore — doesn't block casino/tournament load
    }
  };

  // IMPORTANT: do NOT depend on `data` here; that caused the refresh loop.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      await fetchMe();

      if (!idToUse) {
        // No ID at all — still show whatever we have from params
        setData(casinoParam || null);
        setTournaments([]);
        return;
      }

      const updated = await fetchCasino(idToUse);
      setData(updated || casinoParam || null);

      const list = await fetchTournaments(idToUse);
      setTournaments(list);
    } catch (err) {
      console.warn('CasinoDetail load error:', err?.message);
      setTournaments([]);
    } finally {
      setLoading(false);
    }
  }, [idToUse, casinoParam]);

  useEffect(() => {
    load(); // initial load
    const unsubscribe = navigation.addListener('focus', load); // reload when screen regains focus
    return unsubscribe;
  }, [navigation, load]);

  const renderTournament = ({ item }) => (
    <TouchableOpacity
      style={styles.previewCard}
      onPress={() =>
        navigation.navigate('TournamentDetail', {
          tournament: JSON.parse(JSON.stringify(item)),
          casinoName: (data?.name || casinoNameParam || ''),
          casinoId: idToUse,
        })
      }
    >
      <Text style={styles.title}>{item?.name || 'Tournament'}</Text>
      <Text style={styles.line}>Buy-In: £{item?.buyIn ?? 0} + £{item?.rake ?? 0}</Text>
      <Text style={styles.line}>
        Start: {item?.dateTimeUTC ? new Date(item.dateTimeUTC).toLocaleString() : '—'}
      </Text>
      {typeof item?.prizePool === 'number' && (
        <Text style={styles.line}>Prize Pool: £{item.prizePool}</Text>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>Loading casino details...</Text>
      </View>
    );
  }

  const casinoIdStr = idToUse;
  const canAdd =
    userRole === 'admin' ||
    (userRole === 'staff' && assignedIds.includes(String(casinoIdStr)));

  const dataSafe = data || {};
  const listSafe = Array.isArray(tournaments) ? tournaments : [];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerBox}>
        <Text style={styles.header}>{dataSafe.name || casinoNameParam || 'Casino'}</Text>
        <Text style={styles.address}>
          {typeof dataSafe.address === 'string' ? dataSafe.address : ''}
        </Text>
      </View>

      {canAdd && (
        <View style={styles.buttonWrapper}>
          <Button
            title="➕ Add Tournament"
            onPress={() => navigation.navigate('AddTournament', { casinoId: casinoIdStr })}
            color="#2196F3"
          />
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
    backgroundColor: '#f9f9f9',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBox: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
    elevation: 3,
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  address: {
    fontSize: 14,
    color: '#666',
  },
  buttonWrapper: {
    marginBottom: 16,
  },
  noTournaments: {
    fontStyle: 'italic',
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
  previewCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  line: {
    fontSize: 14,
    color: '#444',
  },
});
