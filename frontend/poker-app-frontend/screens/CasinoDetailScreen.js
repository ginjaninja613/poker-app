import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';

export default function CasinoDetailScreen({ route }) {
  const { casino } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{casino.name}</Text>
      <Text style={styles.address}>{casino.address}</Text>

      {casino.tournaments && casino.tournaments.length > 0 ? (
        <FlatList
          data={casino.tournaments}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item }) => (
            <View style={styles.tournament}>
              <Text style={styles.tournamentName}>{item.name}</Text>
              <Text style={styles.detail}>Buy-In: £{item.buyIn}</Text>
              {item.rake && <Text style={styles.detail}>Rake: £{item.rake}</Text>}
              <Text style={styles.detail}>
                Start Time: {new Date(item.date).toLocaleString()}
              </Text>
              {item.structure && item.structure.length > 0 && (
                <View style={styles.structure}>
                  <Text style={styles.subHeader}>Structure:</Text>
                  {item.structure.map((level, idx) => (
                    <Text key={idx} style={styles.level}>
                      Level {level.level}: {level.duration} min
                    </Text>
                  ))}
                </View>
              )}
            </View>
          )}
        />
      ) : (
        <Text style={styles.noTournaments}>No tournaments listed.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    flex: 1,
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  address: {
    fontSize: 16,
    color: '#555',
    marginBottom: 12,
  },
  tournament: {
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  tournamentName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  detail: {
    fontSize: 14,
    marginBottom: 2,
  },
  subHeader: {
    marginTop: 6,
    fontWeight: 'bold',
  },
  level: {
    fontSize: 13,
    marginLeft: 10,
  },
  noTournaments: {
    marginTop: 20,
    fontStyle: 'italic',
    color: 'gray',
  },
  structure: {
    marginTop: 4,
  },
});
