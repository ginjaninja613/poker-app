import React, { useEffect, useState, useCallback } from 'react';
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

export default function CasinoDetailScreen({ route, navigation }) {
  const { casino } = route.params;
  const [data, setData] = useState(casino);
  const [tournaments, setTournaments] = useState([]); // separate state (not on casino)
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // role from storage (backend still enforces permissions)
      const role = await AsyncStorage.getItem('role');
      setUserRole(role);

      // fetch casino detail
      const resCasino = await fetch(`${API_BASE}/api/casinos/${casino._id}`);
      const textCasino = await resCasino.text();
      try {
        const updated = textCasino ? JSON.parse(textCasino) : casino;
        setData(updated || casino);
      } catch {
        setData(casino); // fallback
      }

      // fetch tournaments for this casino
      const resT = await fetch(`${API_BASE}/api/casinos/${casino._id}/tournaments`);
      const textT = await resT.text();
      try {
        const list = textT ? JSON.parse(textT) : [];
        setTournaments(Array.isArray(list) ? list : []);
      } catch {
        setTournaments([]);
      }
    } catch (err) {
      // minimal logging; UI still renders gracefully
      console.warn('CasinoDetail load error:', err?.message);
      setTournaments([]);
    } finally {
      setLoading(false);
    }
  }, [casino]);

  useEffect(() => {
    load();
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  const renderTournament = ({ item }) => (
    <TouchableOpacity
      style={styles.previewCard}
      onPress={() =>
        navigation.navigate('TournamentDetail', {
          tournament: JSON.parse(JSON.stringify(item)),
          casinoName: data?.name || '',
          casinoId: data?._id,
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

  const canAdd = userRole === 'staff' || userRole === 'admin';
  const dataSafe = data || {};
  const listSafe = Array.isArray(tournaments) ? tournaments : [];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerBox}>
        <Text style={styles.header}>{dataSafe.name || 'Casino'}</Text>
        <Text style={styles.address}>{dataSafe.address || ''}</Text>
      </View>

      {canAdd && (
        <View style={styles.buttonWrapper}>
          <Button
            title="➕ Add Tournament"
            onPress={() => navigation.navigate('AddTournament', { casinoId: dataSafe._id })}
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
