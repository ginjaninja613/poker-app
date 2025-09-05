// frontend/screens/AdminStaffRequestsScreen.js
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

const API_BASE = 'http://192.168.0.178:5000';

export default function AdminStaffRequestsScreen() {
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [requests, setRequests] = useState([]);
  const [assignedCasinoIds, setAssignedCasinoIds] = useState([]);
  const [role, setRole] = useState(null);

  const fetchMe = async (token) => {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Failed to load profile');
    return data; // { id, role, assignedCasinoIds }
  };

  const fetchRequestsForCasino = async (token, cId) => {
    const res = await fetch(
      `${API_BASE}/api/staff-requests?casinoId=${encodeURIComponent(cId)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Failed to load staff requests');
    return data.requests || [];
  };

  const load = async () => {
    try {
      setError('');
      setLoading(true);
      const token = await AsyncStorage.getItem('token');
      if (!token) throw new Error('Please log in as an admin.');

      const me = await fetchMe(token);
      setRole(me.role);

      if (me.role !== 'admin') {
        throw new Error('Only admins can view staff requests.');
      }
      const cids = Array.isArray(me.assignedCasinoIds) ? me.assignedCasinoIds : [];
      if (!cids.length) throw new Error('Your admin account is not assigned to any casino.');
      setAssignedCasinoIds(cids);

      // Fetch all casinos you manage, merge results
      const all = [];
      for (const cId of cids) {
        const list = await fetchRequestsForCasino(token, cId);
        // annotate each item with casinoId string for clarity
        for (const r of list) all.push({ ...r, _casinoId: String(cId) });
      }
      setRequests(all);
    } catch (e) {
      setError(e.message);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      const token = await AsyncStorage.getItem('token');
      if (!token || !assignedCasinoIds.length) return;
      const all = [];
      for (const cId of assignedCasinoIds) {
        const list = await fetchRequestsForCasino(token, cId);
        for (const r of list) all.push({ ...r, _casinoId: String(cId) });
      }
      setRequests(all);
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  };

  const actOnRequest = async (id, action) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) throw new Error('Not authenticated.');
      const res = await fetch(`${API_BASE}/api/staff-requests/${id}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Failed to ${action} request`);
      await onRefresh();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const confirmApprove = (id) => {
    Alert.alert('Approve Staff Request', 'Approve this request?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: () => actOnRequest(id, 'approve') },
    ]);
  };

  const confirmDeny = (id) => {
    Alert.alert('Deny Staff Request', 'Deny this request?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Deny', style: 'destructive', onPress: () => actOnRequest(id, 'deny') },
    ]);
  };

  const renderItem = ({ item }) => {
    const userName = item?.userId?.name || 'Unknown';
    const userEmail = item?.userId?.email || 'Unknown';
    const casinoTag = item?._casinoId ? ` (Casino: ${item._casinoId})` : '';
    return (
      <View style={styles.card}>
        <Text style={styles.name}>{userName}</Text>
        <Text style={styles.email}>{userEmail}{casinoTag}</Text>
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, styles.approve]} onPress={() => confirmApprove(item._id)}>
            <Text style={styles.btnText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.deny]} onPress={() => confirmDeny(item._id)}>
            <Text style={styles.btnText}>Deny</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 10 }}>Loading staff requests…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Staff Requests</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!error && requests.length === 0 ? (
        <View style={styles.center}>
          <Text>No pending requests for your casinos.</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  header: { fontSize: 22, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { color: 'red', textAlign: 'center', marginBottom: 12 },
  card: {
    borderWidth: 1,
    borderColor: '#e3e3e3',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#fafafa',
  },
  name: { fontSize: 16, fontWeight: '600' },
  email: { fontSize: 14, color: '#666', marginTop: 2 },
  actions: { flexDirection: 'row', marginTop: 12, gap: 10 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  approve: { backgroundColor: '#28a745' },
  deny: { backgroundColor: '#dc3545' },
  btnText: { color: '#fff', fontWeight: '600' },
});
