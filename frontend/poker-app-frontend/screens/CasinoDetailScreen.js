import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Button,
  ActivityIndicator,
  ScrollView,
} from 'react-native';

export default function CasinoDetailScreen({ route, navigation }) {
  const { casino } = route.params;
  const [data, setData] = useState(casino);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUpdatedCasino = async () => {
      try {
        const res = await fetch(`http://192.168.0.180:5000/api/casinos/${casino._id}`);
        const updated = await res.json();
        setData(updated);
      } catch (err) {
        console.error('Error fetching casino:', err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUpdatedCasino();
    const unsubscribe = navigation.addListener('focus', fetchUpdatedCasino);
    return unsubscribe;
  }, [navigation]);

  const renderTournament = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.title}>{item.name}</Text>
      <Text>Buy-In: £{item.buyIn}</Text>
      <Text>Rake: £{item.rake}</Text>
      <Text>Start Time: {new Date(item.date).toLocaleString()}</Text>

      {item.startingChips && <Text>Starting Chips: {item.startingChips}</Text>}
      {item.gameType && <Text>Game Type: {item.gameType}</Text>}
      {item.prizePool && <Text>Prize Pool: £{item.prizePool}</Text>}
      {item.lateRegistrationMinutes && <Text>Late Registration: {item.lateRegistrationMinutes} min</Text>}
      {item.reentriesAllowed >= 0 && <Text>Re-Entries Allowed: {item.reentriesAllowed}</Text>}
      {item.isBounty && item.bountyAmount && (
        <Text>Bounty: £{item.bountyAmount} per knockout</Text>
      )}

      {item.structure && item.structure.length > 0 && (
        <>
          <Text style={styles.subHeader}>Structure:</Text>
          {item.structure.map((level, index) => (
            <Text key={index}>
              {level.level} – {level.duration} min
            </Text>
          ))}
        </>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>Loading casino details...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>{data.name}</Text>
      <Text>{data.address}</Text>

      <Button
        title="Add Tournament"
        onPress={() => navigation.navigate('AddTournament', { casinoId: data._id })}
      />

      {data.tournaments.length === 0 ? (
        <Text style={{ marginTop: 20 }}>No tournaments available.</Text>
      ) : (
        <FlatList
          data={data.tournaments}
          keyExtractor={(item, index) => index.toString()}
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
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  card: {
    marginVertical: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
  },
  title: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  subHeader: {
    fontWeight: 'bold',
    marginTop: 8,
  },
});
