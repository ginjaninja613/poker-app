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
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logout } from '../services/AuthService';
import { useAuth } from '../App';

const API_BASE = 'http://192.168.0.178:5000';

export default function HomeScreen({ navigation }) {
  const auth = useAuth();

  const [casinos, setCasinos] = useState([]);          // always an array
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const safeSetCasinos = (data) => {
    setCasinos(Array.isArray(data) ? data : []);
  };

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
    try {
      // Ask for permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        // No location? Just fetch all casinos
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
        // fallback to all casinos if nearby fails (e.g., no geo index yet)
        await fetchAllCasinos();
        return;
      }

      try {
        const data = text ? JSON.parse(text) : [];
        safeSetCasinos(data);
      } catch {
        // fallback on bad JSON
        await fetchAllCasinos();
      }
    } catch (err) {
      setError(err?.message || 'Failed to load casinos');
      // final safety: try all casinos once
      try { await fetchAllCasinos(); } catch {}
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCasinos();
  }, [loadCasinos]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCasinos();
  };

  const handleLogout = async () => {
    try {
      await logout();                          // clears token + role
      await AsyncStorage.removeItem('casinoId'); // clear any stored casino
    } catch (e) {
      console.warn('Logout error:', e);
    } finally {
      auth.signOut(); // flip to Login stack immediately
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>Loading nearby casinos...</Text>
        <Button title="Logout" onPress={handleLogout} />
      </View>
    );
  }

  if (error) {
    // Non-blocking: still render list (might be from fallback)
    console.warn('Home error:', error);
  }

  const dataSafe = Array.isArray(casinos) ? casinos : [];

  return (
    <View style={styles.container}>
      <Button title="Logout" onPress={handleLogout} />
      <FlatList
        data={dataSafe}
        keyExtractor={(item, index) => item?._id ?? String(index)}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>No casinos found.</Text>}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={dataSafe.length === 0 && { flex: 1, justifyContent: 'center' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    flex: 1,
  },
  card: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  name: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  address: {
    fontSize: 14,
    color: '#666',
  },
  distance: {
    fontSize: 13,
    color: '#007aff',
    marginTop: 4,
  },
  empty: {
    textAlign: 'center',
    color: 'gray',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
});
