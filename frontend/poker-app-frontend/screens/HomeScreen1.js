// frontend/screens/HomeScreen1.js
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Button,
  RefreshControl,
} from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logout } from '../services/AuthService';
import { useAuth } from '../App';

const API_BASE = 'http://192.168.0.178:5000';

export default function HomeScreen({ navigation }) {
  const auth = useAuth();

  const [casinos, setCasinos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // role + pending requests
  const [role, setRole] = useState(null);                // 'admin' | 'staff' | 'user' | null
  const [pendingCount, setPendingCount] = useState(null); // number of pending staff requests (admins only)

  const safeSetCasinos = (data) => setCasinos(Array.isArray(data) ? data : []);

  // --- Pending staff requests count (for admins) ---
  const fetchPendingCount = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        setRole(null);
        setPendingCount(null);
        return;
      }
      // who am I?
      const meRes = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const me = await meRes.json();
      if (!meRes.ok) {
        setRole(null);
        setPendingCount(null);
        return;
      }
      const r = (me.role || '').toLowerCase();
      setRole(r);

      const cids = Array.isArray(me.assignedCasinoIds) ? me.assignedCasinoIds : [];
      if (r !== 'admin' || cids.length === 0) {
        setPendingCount(null);
        return;
      }

      let total = 0;
      for (const cId of cids) {
        try {
          const res = await fetch(
            `${API_BASE}/api/staff-requests?casinoId=${encodeURIComponent(cId)}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const data = await res.json();
          if (res.ok && Array.isArray(data.requests)) {
            total += data.requests.length;
          }
        } catch {}
      }
      setPendingCount(total);
    } catch {
      setPendingCount(null);
    }
  }, []);

  // --- Casinos loading ---
  const fetchAllCasinos = async () => {
    const res = await fetch(`${API_BASE}/api/casinos`);
    const text = await res.text();
    try {
      const json = text ? JSON.parse(text) : [];
      safeSetCasinos(json);
    } catch {
      safeSetCasinos([]);
      throw new Error('Failed to parse casinos list');
    }
  };

  const loadCasinos = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      // Ask for location permission (fallback to all casinos)
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        await fetchAllCasinos();
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const latitude = location.coords.latitude;
      const longitude = location.coords.longitude;

      const res = await fetch(
        `${API_BASE}/api/casinos/nearby?lat=${latitude}&lng=${longitude}`
      );
      const text = await res.text();
      if (!res.ok) {
        await fetchAllCasinos();
        return;
      }

      try {
        const data = text ? JSON.parse(text) : [];
        safeSetCasinos(data);
      } catch {
        await fetchAllCasinos();
      }
    } catch (err) {
      setError(err?.message || 'Failed to load casinos');
      try { await fetchAllCasinos(); } catch {}
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // initial load + refresh on focus
  useEffect(() => {
    loadCasinos();
    fetchPendingCount();
    const unsub = navigation.addListener('focus', () => {
      loadCasinos();
      fetchPendingCount();
    });
    return unsub;
  }, [navigation, loadCasinos, fetchPendingCount]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadCasinos(), fetchPendingCount()]);
  };

  const handleLogout = async () => {
    try {
      await logout();
      await AsyncStorage.removeItem('casinoId');
    } catch (e) {
      console.warn('Logout error:', e);
    } finally {
      auth.signOut();
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('CasinoDetail', { casino: item })}
    >
      <View>
        <Text style={styles.name}>{item?.name || 'Unnamed Casino'}</Text>
        <Text style={styles.address}>{item?.address || 'No address provided'}</Text>
        {typeof item?.distance === 'number' && (
          <Text style={styles.distance}>
            {(item.distance / 1000).toFixed(1)} km away
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const TopBar = () => (
    <View style={styles.topBar}>
      <View style={styles.topBarLeft}>
        <Button title="Logout" onPress={handleLogout} />
      </View>
      <View style={styles.topBarRight}>
        <Button
          title={`Staff Requests${typeof pendingCount === 'number' ? ` (${pendingCount})` : ''}`}
          onPress={() => navigation.navigate('AdminStaffRequests')}
        />
      </View>
    </View>
  );

  const dataSafe = Array.isArray(casinos) ? casinos : [];

  return (
    <View style={styles.root}>
      <TopBar />
      {loading ? (
        <View style={[styles.container, styles.center]}>
          <ActivityIndicator size="large" />
          <Text>Loading nearby casinos...</Text>
          {error ? <Text style={{ color: 'red', marginTop: 6 }}>{String(error)}</Text> : null}
        </View>
      ) : (
        <View style={styles.container}>
          <FlatList
            data={dataSafe}
            keyExtractor={(item, index) => item?._id ?? String(index)}
            renderItem={renderItem}
            ListEmptyComponent={<Text style={styles.empty}>No casinos found.</Text>}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={dataSafe.length === 0 && { flex: 1, justifyContent: 'center' }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  topBar: {
    paddingTop: 10,
    paddingHorizontal: 12,
    paddingBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  topBarLeft: { flexShrink: 0 },
  topBarRight: { flexShrink: 0 },
  container: { padding: 16, backgroundColor: '#fff', flex: 1 },
  card: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#ccc' },
  name: { fontWeight: 'bold', fontSize: 16 },
  address: { fontSize: 14, color: '#666' },
  distance: { fontSize: 13, color: '#007aff', marginTop: 4 },
  empty: { textAlign: 'center', color: 'gray' },
  center: { justifyContent: 'center', alignItems: 'center', gap: 8 },
});
