import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Button, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

const API_BASE = 'http://192.168.0.178:5000';

export default function TournamentDetailScreen({ route, navigation }) {
  const { tournament: initialTournament, casinoName, casinoId } = route.params;
  const [tournament, setTournament] = useState(initialTournament || {});
  const [canEdit, setCanEdit] = useState(false);

  const structure = Array.isArray(tournament?.structure) ? tournament.structure : [];
  const days = Array.isArray(tournament?.days) ? tournament.days : [];

  useEffect(() => {
    (async () => {
      const role = await AsyncStorage.getItem('role');
      setCanEdit(role === 'staff' || role === 'admin');
    })();
  }, []);

  const parseJson = async (res) => {
    const t = await res.text();
    try { return t ? JSON.parse(t) : {}; } catch { throw new Error('Invalid JSON'); }
  };

  useFocusEffect(
    useCallback(() => {
      const fetchTournament = async () => {
        try {
          const res = await fetch(`${API_BASE}/api/tournaments/${tournament._id}`);
          const updated = await parseJson(res);
          if (!res.ok) throw new Error(updated?.error || 'Failed to reload tournament');
          setTournament(updated);
        } catch (err) {
          console.error('🔄 Error refreshing tournament:', err.message);
        }
      };
      if (tournament?._id) fetchTournament();
    }, [tournament?._id])
  );

  const handleDelete = () => {
    Alert.alert('Confirm Delete', 'Delete this tournament?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem('token');
            const res = await fetch(`${API_BASE}/api/casinos/${casinoId}/tournaments/${tournament._id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            });
            const data = await parseJson(res);
            if (!res.ok) throw new Error(data?.error || 'Delete failed');
            Alert.alert('Success', 'Tournament deleted'); navigation.goBack();
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  const renderStructureTable = (levels) => {
    if (!Array.isArray(levels) || levels.length === 0) return null;
    return (
      <View style={styles.structureBox}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCell, styles.headerCell]}>SB</Text>
          <Text style={[styles.tableCell, styles.headerCell]}>BB</Text>
          <Text style={[styles.tableCell, styles.headerCell]}>Ante</Text>
          <Text style={[styles.tableCell, styles.headerCell]}>Duration</Text>
        </View>
        {levels.map((entry, idx) => {
          const isBreak = !!entry?.isBreak;
          return (
            <View key={idx} style={[styles.tableRow, isBreak && styles.breakRow]}>
              {isBreak ? (
                <>
                  <Text style={[styles.tableCell, styles.breakCell]}>Break</Text>
                  <Text style={styles.tableCell}>–</Text>
                  <Text style={styles.tableCell}>–</Text>
                  <Text style={styles.tableCell}>
                    {entry?.durationMinutes != null ? `${entry.durationMinutes} min` : '—'}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.tableCell}>{entry?.smallBlind ?? '—'}</Text>
                  <Text style={styles.tableCell}>{entry?.bigBlind ?? '—'}</Text>
                  <Text style={styles.tableCell}>{entry?.ante ?? '—'}</Text>
                  <Text style={styles.tableCell}>
                    {entry?.durationMinutes != null ? `${entry.durationMinutes} min` : '—'}
                  </Text>
                </>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>{tournament?.name || 'Tournament'}</Text>
      <Text style={styles.subheader}>@ {casinoName || ''}</Text>

      <Text style={styles.item}>🎯 Buy-In: £{tournament?.buyIn ?? 0}</Text>
      <Text style={styles.item}>💸 Rake: £{tournament?.rake ?? 0}</Text>
      {!!tournament?.prizePool && (
        <Text style={styles.item}>💰 Prize Pool: £{tournament.prizePool}</Text>
      )}
      {!!tournament?.startingStack && (
        <Text style={styles.item}>🪙 Starting Stack: {tournament.startingStack}</Text>
      )}
      <Text style={styles.item}>🃏 Game: {tournament?.gameType || 'No Limit Hold’em'}</Text>
      <Text style={styles.item}>
        🕒 Start: {tournament?.dateTimeUTC ? new Date(tournament.dateTimeUTC).toLocaleString() : '—'}
      </Text>

      {!!tournament?.bounty && tournament.bounty > 0 && (
        <Text style={styles.item}>🏆 Bounty: £{tournament.bounty}</Text>
      )}

      {tournament?.reEntry && (
        <Text style={styles.item}>
          🔁 Re-Entry: {tournament?.reEntryUnlimited ? 'Unlimited' : `Max ${tournament?.reEntryCount ?? 0}`}
        </Text>
      )}

      {!!tournament?.notes && (
        <View style={{ marginTop: 8 }}>
          <Text style={styles.sectionHeader}>📝 Notes</Text>
          <Text style={styles.item}>{tournament.notes}</Text>
        </View>
      )}

      {days.length > 0 && (
        <View style={{ marginTop: 12 }}>
          <Text style={styles.sectionHeader}>📅 Days</Text>
          {days
            .slice()
            .sort((a, b) => new Date(a.startTimeUTC) - new Date(b.startTimeUTC))
            .map((d, i) => (
              <View key={i} style={{ marginBottom: 10 }}>
                <Text style={styles.item}>
                  {d.label || `Day ${i + 1}`} — {new Date(d.startTimeUTC).toLocaleString()}
                </Text>
                {Array.isArray(d.structure) && d.structure.length > 0 && renderStructureTable(d.structure)}
              </View>
            ))}
        </View>
      )}

      {(!days.length || !days.some((d) => Array.isArray(d.structure) && d.structure.length > 0)) &&
        renderStructureTable(structure)}

      {canEdit && (
        <View style={styles.buttonRow}>
          <Button title="✏️ Edit" onPress={() => navigation.navigate('EditTournament', { tournamentId: tournament._id, casinoId })} />
          <View style={{ width: 10 }} />
          <Button title="🗑️ Delete" color="#c00" onPress={handleDelete} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#f6f6f6' },
  header: { fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  subheader: { fontSize: 14, color: '#555', marginBottom: 12 },
  item: { fontSize: 14, marginVertical: 2 },
  sectionHeader: { fontSize: 16, fontWeight: 'bold', marginTop: 10, marginBottom: 4 },
  structureBox: { marginTop: 10 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#ccc', marginBottom: 4, paddingBottom: 4 },
  tableRow: { flexDirection: 'row', paddingVertical: 6 },
  tableCell: { flex: 1, fontSize: 13, textAlign: 'center' },
  headerCell: { fontWeight: 'bold' },
  breakRow: { backgroundColor: '#fce4ec' },
  breakCell: { flex: 1, fontWeight: 'bold', textAlign: 'center', color: '#c62828' },
  buttonRow: { flexDirection: 'row', marginTop: 20, justifyContent: 'center' },
});
