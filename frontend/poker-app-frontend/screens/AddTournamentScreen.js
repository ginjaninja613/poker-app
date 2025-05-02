import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Switch,
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

export default function AddTournamentScreen({ route, navigation }) {
  const { casinoId } = route.params;

  const [name, setName] = useState('');
  const [buyIn, setBuyIn] = useState('');
  const [rake, setRake] = useState('');
  const [date, setDate] = useState(new Date());
  const [structure, setStructure] = useState([]);
  const [newLevel, setNewLevel] = useState('');
  const [newDuration, setNewDuration] = useState('');
  const [startingChips, setStartingChips] = useState('');
  const [gameType, setGameType] = useState('No Limit Hold’em');
  const [prizePool, setPrizePool] = useState('');
  const [lateRegistrationMinutes, setLateRegistrationMinutes] = useState('');
  const [reentriesAllowed, setReentriesAllowed] = useState('');
  const [isBounty, setIsBounty] = useState(false);
  const [bountyAmount, setBountyAmount] = useState('');
  const [isPickerVisible, setPickerVisible] = useState(false);

  const handleAddLevel = () => {
    if (!newLevel || !newDuration) {
      Alert.alert('Error', 'Enter both level name and duration');
      return;
    }
    setStructure([...structure, { level: newLevel, duration: parseInt(newDuration) }]);
    setNewLevel('');
    setNewDuration('');
  };

  const handleConfirm = (selectedDate) => {
    setDate(selectedDate);
    setPickerVisible(false);
  };

  const handleSubmit = async () => {
    const tournament = {
      name,
      buyIn: Number(buyIn),
      rake: Number(rake),
      date,
      structure,
      startingChips: Number(startingChips),
      gameType,
      prizePool: prizePool ? Number(prizePool) : undefined,
      lateRegistrationMinutes: Number(lateRegistrationMinutes),
      reentriesAllowed: Number(reentriesAllowed),
      isBounty,
      bountyAmount: isBounty ? Number(bountyAmount) : undefined,
    };

    console.log('🎯 Submitting tournament:', tournament);

    try {
      const response = await fetch(
        `http://192.168.0.180:5000/api/casinos/${casinoId}/tournaments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tournament),
        }
      );

      if (!response.ok) throw new Error('Failed to save tournament');

      Alert.alert('Success', 'Tournament added!');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Tournament Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />

      <Text style={styles.label}>Buy-In (£)</Text>
      <TextInput style={styles.input} value={buyIn} onChangeText={setBuyIn} keyboardType="numeric" />

      <Text style={styles.label}>Rake (£)</Text>
      <TextInput style={styles.input} value={rake} onChangeText={setRake} keyboardType="numeric" />

      <Text style={styles.label}>Start Date & Time</Text>
      <TouchableOpacity onPress={() => setPickerVisible(true)} style={styles.input}>
        <Text>{date.toLocaleString()}</Text>
      </TouchableOpacity>

      <DateTimePickerModal
        isVisible={isPickerVisible}
        mode="datetime"
        date={date}
        onConfirm={handleConfirm}
        onCancel={() => setPickerVisible(false)}
      />

      <Text style={styles.label}>Starting Chips</Text>
      <TextInput style={styles.input} value={startingChips} onChangeText={setStartingChips} keyboardType="numeric" />

      <Text style={styles.label}>Game Type</Text>
      <TextInput
        style={styles.input}
        value={gameType}
        onChangeText={setGameType}
        placeholder="e.g. No Limit Hold’em, PLO"
      />

      <Text style={styles.label}>Prize Pool (optional)</Text>
      <TextInput style={styles.input} value={prizePool} onChangeText={setPrizePool} keyboardType="numeric" />

      <Text style={styles.label}>Late Registration (minutes)</Text>
      <TextInput style={styles.input} value={lateRegistrationMinutes} onChangeText={setLateRegistrationMinutes} keyboardType="numeric" />

      <Text style={styles.label}>Re-Entries Allowed</Text>
      <TextInput style={styles.input} value={reentriesAllowed} onChangeText={setReentriesAllowed} keyboardType="numeric" />

      <Text style={styles.label}>Bounty Tournament?</Text>
      <View style={styles.switchRow}>
        <Text>{isBounty ? 'Yes' : 'No'}</Text>
        <Switch value={isBounty} onValueChange={setIsBounty} />
      </View>

      {isBounty && (
        <>
          <Text style={styles.label}>Bounty Amount (£)</Text>
          <TextInput style={styles.input} value={bountyAmount} onChangeText={setBountyAmount} keyboardType="numeric" />
        </>
      )}

      <Text style={styles.label}>Add Structure (blinds or breaks)</Text>
      <TextInput
        style={styles.input}
        placeholder='e.g. "100/200" or "Break"'
        value={newLevel}
        onChangeText={setNewLevel}
      />
      <TextInput
        style={styles.input}
        placeholder="Duration (minutes)"
        value={newDuration}
        onChangeText={setNewDuration}
        keyboardType="numeric"
      />
      <Button title="Add Level" onPress={handleAddLevel} />

      {structure.length > 0 && (
        <View style={styles.structureList}>
          <Text style={styles.subHeader}>Structure Preview:</Text>
          {structure.map((item, index) => (
            <Text key={index}>
              {item.level} – {item.duration} min
            </Text>
          ))}
        </View>
      )}

      <View style={{ marginTop: 20 }}>
        <Button title="Submit Tournament" onPress={handleSubmit} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
  },
  label: {
    fontWeight: 'bold',
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#aaa',
    borderRadius: 5,
    padding: 10,
    marginTop: 4,
    marginBottom: 10,
  },
  subHeader: {
    marginTop: 12,
    fontWeight: 'bold',
  },
  structureList: {
    marginTop: 10,
    marginBottom: 20,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
});
