import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';

export default function HomeScreen({ navigation }) {
  const [casinos, setCasinos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setError('Permission to access location was denied');
          setLoading(false);
          return;
        }

        let location = await Location.getCurrentPositionAsync({});
        const latitude = location.coords.latitude;
        const longitude = location.coords.longitude;

        console.log('Device location:', latitude, longitude);

        const response = await fetch(
          `http://192.168.0.180:5000/api/casinos/nearby?lat=${latitude}&lng=${longitude}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch casinos: ' + response.status);
        }

        const data = await response.json();
        setCasinos(data);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('CasinoDetail', { casino: item })}
    >
      <View>
        <Text style={styles.name}>{item.name || 'Unnamed Casino'}</Text>
        <Text style={styles.address}>{item.address || 'No address provided'}</Text>
        {typeof item.distance === 'number' && (
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
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Error: {error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={casinos}
        keyExtractor={(item) => item._id || Math.random().toString()}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={styles.empty}>No casinos found near you.</Text>
        }
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
    marginTop: 20,
    textAlign: 'center',
    color: 'gray',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  error: {
    color: 'red',
    fontSize: 16,
  },
});
