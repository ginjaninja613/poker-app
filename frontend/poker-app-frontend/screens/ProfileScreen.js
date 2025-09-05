// frontend/screens/ProfileScreen.js
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { logout } from '../services/AuthService';
import { useAuth } from '../context/AuthContext'; // ⬅️ moved import here

const API_BASE = 'http://192.168.0.178:5000';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const auth = useAuth();
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [error, setError] = useState(null);
  const [casinoNamesById, setCasinoNamesById] = useState({});
  const [distanceUnit, setDistanceUnit] = useState('km');

  const loadUnitPref = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem('distanceUnit');
      if (stored === 'mi' || stored === 'km') setDistanceUnit(stored);
      else setDistanceUnit('km');
    } catch {
      setDistanceUnit('km');
    }
  }, []);

  const saveUnitPref = useCallback(async (unit) => {
    try {
      await AsyncStorage.setItem('distanceUnit', unit);
      setDistanceUnit(unit);
    } catch {
      Alert.alert('Error', 'Could not save distance unit.');
    }
  }, []);

  const loadMe = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Session ended', 'Please log in again.');
        auth.signOut();
        return;
      }

      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || 'Failed to fetch profile');
      }
      setMe(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [auth]);

  const loadCasinos = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/casinos`);
      const data = await res.json();
      if (!Array.isArray(data)) return;

      const map = {};
      data.forEach((c) => {
        const key = c?._id || c?.id || c?.casinoId;
        const name = c?.name || c?.title || c?.casinoName;
        if (key && name) map[key] = name;
      });
      setCasinoNamesById(map);
    } catch {}
  }, []);

  useEffect(() => {
    loadMe();
    loadCasinos();
    loadUnitPref();
  }, [loadMe, loadCasinos, loadUnitPref]);

  const onLogout = async () => {
    try {
      await logout();
      auth.signOut();
    } catch (e) {
      Alert.alert('Error', 'Failed to log out. Please try again.');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.muted}>Loading your profile…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerPad}>
        <Text style={styles.error}>Error: {error}</Text>
        <TouchableOpacity style={styles.button} onPress={loadMe}>
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const assignedIds = Array.isArray(me?.assignedCasinoIds) ? me.assignedCasinoIds : [];
  const assigned =
    assignedIds.length > 0
      ? assignedIds.map((id) => casinoNamesById[id] || 'Unknown').join(', ')
      : 'None';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{me?.name || '—'}</Text>

        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{me?.email || '—'}</Text>

        <Text style={styles.label}>Role</Text>
        <Text style={styles.value}>{me?.role || 'user'}</Text>

        <Text style={styles.label}>Assigned Casinos</Text>
        <Text style={styles.value}>{assigned}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Distance Unit</Text>
        <View style={styles.rowButtons}>
          <TouchableOpacity
            style={[styles.pill, distanceUnit === 'km' ? styles.pillActive : null]}
            onPress={() => saveUnitPref('km')}
          >
            <Text style={[styles.pillText, distanceUnit === 'km' ? styles.pillTextActive : null]}>
              Kilometers
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pill, distanceUnit === 'mi' ? styles.pillActive : null]}
            onPress={() => saveUnitPref('mi')}
          >
            <Text style={[styles.pillText, distanceUnit === 'mi' ? styles.pillTextActive : null]}>
              Miles
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.mutedSmall}>
          Home list will sort by distance and display using this unit.
        </Text>
      </View>

      {me?.role === 'admin' && (
        <TouchableOpacity
          style={[styles.button, styles.secondary]}
          onPress={() => navigation.navigate('AdminStaffRequests')}
        >
          <Text style={styles.buttonText}>Manage Staff Requests</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.button} onPress={loadMe}>
        <Text style={styles.buttonText}>Refresh</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.danger]} onPress={onLogout}>
        <Text style={styles.buttonText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerPad: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  muted: { marginTop: 8, color: '#555' },
  mutedSmall: { marginTop: 8, color: '#6b7280', fontSize: 12 },
  container: { padding: 16, gap: 16 },
  title: { fontSize: 28, fontWeight: '700' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    gap: 6,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  rowButtons: { flexDirection: 'row', gap: 8, marginTop: 4 },
  pill: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
  },
  pillActive: { backgroundColor: '#111827' },
  pillText: { fontSize: 14, fontWeight: '600', color: '#111827' },
  pillTextActive: { color: '#fff' },
  label: { fontSize: 12, color: '#666', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 8 },
  value: { fontSize: 16, fontWeight: '600' },
  button: {
    backgroundColor: '#111827',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondary: { backgroundColor: '#334155' },
  danger: { backgroundColor: '#b91c1c' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: '#b91c1c', marginBottom: 12 },
});
