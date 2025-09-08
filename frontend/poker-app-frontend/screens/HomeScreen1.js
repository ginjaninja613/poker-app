// frontend/screens/HomeScreen1.js
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';

const API_BASE = 'http://192.168.0.178:5000'; // update if your backend IP changes

// Haversine distance in kilometers
function distanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Try to extract casino coordinates from various shapes
function getCasinoCoords(item) {
  // GeoJSON style: { type: 'Point', coordinates: [lng, lat] }
  if (item?.location && typeof item.location === 'object') {
    const coords = item.location.coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      const [lng, lat] = coords;
      if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng };
    }
    // Sometimes nested fields like { lat, lng } or { latitude, longitude }
    if (typeof item.location.lat === 'number' && typeof item.location.lng === 'number') {
      return { lat: item.location.lat, lng: item.location.lng };
    }
    if (typeof item.location.latitude === 'number' && typeof item.location.longitude === 'number') {
      return { lat: item.location.latitude, lng: item.location.longitude };
    }
  }
  // Flat fields
  if (typeof item?.lat === 'number' && typeof item?.lng === 'number') {
    return { lat: item.lat, lng: item.lng };
  }
  if (typeof item?.latitude === 'number' && typeof item?.longitude === 'number') {
    return { lat: item.latitude, lng: item.longitude };
  }
  return null;
}

// Fallback text if we don't have distance
function formatLocationString(item) {
  const city = item?.city;
  const loc = item?.location;

  if (typeof city === 'string' && city.trim()) return city.trim();
  if (typeof loc === 'string' && loc.trim()) return loc.trim();

  if (loc && typeof loc === 'object') {
    if (typeof loc.city === 'string' && loc.city.trim()) return loc.city.trim();
    if (typeof loc.name === 'string' && loc.name.trim()) return loc.name.trim();
    if (typeof loc.town === 'string' && loc.town.trim()) return loc.town.trim();
  }
  return null;
}

function kmToDisplay(km, unit) {
  if (typeof km !== 'number') return null;
  if (unit === 'mi') return km * 0.621371;
  return km; // km
}

export default function HomeScreen({ navigation }) {
  const [casinos, setCasinos] = useState([]); // raw array
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [userCoords, setUserCoords] = useState(null); // { lat, lng }
  const [distanceUnit, setDistanceUnit] = useState('km'); // 'km' | 'mi'

  const safeSetCasinos = (data) => {
    setCasinos(Array.isArray(data) ? data : []);
  };

  // Get user's current position once (don’t block loading casinos)
  const getUserLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setUserCoords(null); // permission denied; we’ll show city text instead
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      setUserCoords(null);
    }
  }, []);

  const fetchAllCasinos = useCallback(async () => {
    try {
      setError(null);
      if (!refreshing) setLoading(true);

      const res = await fetch(`${API_BASE}/api/casinos`);
      const data = await res.json();
      safeSetCasinos(data);
    } catch (e) {
      setError('Failed to load casinos. Pull to refresh to try again.');
      safeSetCasinos([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing]);

  const loadUnitPref = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem('distanceUnit');
      if (stored === 'mi' || stored === 'km') setDistanceUnit(stored);
      else setDistanceUnit('km');
    } catch {
      setDistanceUnit('km');
    }
  }, []);

  useEffect(() => {
    fetchAllCasinos();
    getUserLocation();
    loadUnitPref();
  }, [fetchAllCasinos, getUserLocation, loadUnitPref]);

  useFocusEffect(
    useCallback(() => {
      // refresh list and unit whenever returning to Home
      loadUnitPref();
      fetchAllCasinos();
    }, [loadUnitPref, fetchAllCasinos])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchAllCasinos(), getUserLocation(), loadUnitPref()]);
  };

  // Build a derived, sorted list WITH distance (if possible)
  const dataSorted = useMemo(() => {
    const list = (casinos || []).map((c) => {
      let dKm = null;
      const cc = getCasinoCoords(c);
      if (userCoords && cc) {
        dKm = distanceKm(userCoords.lat, userCoords.lng, cc.lat, cc.lng);
      }
      return { ...c, __distanceKm: dKm };
    });

    // Sort: items with distance first, by ascending distance; items without distance at the end
    list.sort((a, b) => {
      const da = a.__distanceKm;
      const db = b.__distanceKm;
      if (da == null && db == null) return 0;
      if (da == null) return 1;
      if (db == null) return -1;
      return da - db;
    });

    return list;
  }, [casinos, userCoords]);

  const renderItem = ({ item }) => {
    const id = item?._id || item?.id || item?.casinoId;

    const rawName = item?.name || item?.title || item?.casinoName;
    const name =
      typeof rawName === 'string' && rawName.trim()
        ? rawName
        : 'Unknown Casino';

    // Prefer distance if we have it; else fallback to a place string
    let subtitle = null;
    if (typeof item.__distanceKm === 'number') {
      const val = kmToDisplay(item.__distanceKm, distanceUnit);
      const unitLabel = distanceUnit === 'mi' ? 'mi' : 'km';
      subtitle = `${val.toFixed(1)} ${unitLabel} away`;
    } else {
      subtitle = formatLocationString(item);
    }

    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.85}
        onPress={() =>
          navigation.navigate('CasinoDetail', {
            casinoId: id,
            casinoName: name,
            casino: item, // ⬅️ pass the full casino object
          })
        }
      >
        <View style={styles.rowLeft}>
          <Text style={styles.rowTitle}>{name}</Text>
          {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.muted}>Loading casinos…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={dataSorted}
        keyExtractor={(item, idx) => String(item?._id || item?.id || item?.casinoId || idx)}
        renderItem={renderItem}
        contentContainerStyle={dataSorted.length === 0 && { flex: 1, justifyContent: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.muted}>No casinos found.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.backgroundLight },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { marginTop: 8, color: theme.colors.grey, fontFamily: theme.fonts.body },
  error: {
    padding: 12,
    color: '#b91c1c',
    textAlign: 'center',
    fontFamily: theme.fonts.body,
  },

  // LIST ROW (green)
  row: {
    backgroundColor: theme.colors.primary,
    marginHorizontal: 12,
    marginVertical: 8,
    padding: 16,
    borderRadius: 14,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: { flexShrink: 1, paddingRight: 10 },
  rowTitle: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: theme.fonts.heading,
  },
  rowSub: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: theme.fonts.body,
  },
});
