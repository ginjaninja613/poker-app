import React, { useState } from 'react';
import {
  View, Text, TextInput, Button, StyleSheet, ScrollView, Alert,
  TouchableOpacity, Switch, Keyboard, Platform, InputAccessoryView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

const API_BASE = 'http://192.168.0.178:5000';
const ACCESSORY_ID = 'numericDoneAccessory';
const GAME_TYPES = ['No Limit Hold’em', 'Pot Limit Omaha', 'Omaha Hi/Lo', 'Mixed', 'Other'];

function NumericInput({ style, ...rest }) {
  return (
    <TextInput
      style={style}
      keyboardType="number-pad"
      returnKeyType="done"
      blurOnSubmit
      onSubmitEditing={() => Keyboard.dismiss()}
      {...(Platform.OS === 'ios' ? { inputAccessoryViewID: ACCESSORY_ID } : {})}
      {...rest}
    />
  );
}

export default function AddTournamentScreen({ route, navigation }) {
  const { casinoId } = route.params;

  // Basic
  const [name, setName] = useState('');
  const [buyIn, setBuyIn] = useState('');
  const [rake, setRake] = useState('');
  const [date, setDate] = useState(new Date());
  const [isPickerVisible, setPickerVisible] = useState(false);

  // Game type (default NLH) and notes
  const [gameType, setGameType] = useState('No Limit Hold’em');
  const [notes, setNotes] = useState('');

  // Stack & prize pool (RESTORED)
  const [startingStack, setStartingStack] = useState('');
  const [prizePool, setPrizePool] = useState('');

  // Re-entry UX
  const [allowReEntry, setAllowReEntry] = useState(false);
  const [unlimitedReEntry, setUnlimitedReEntry] = useState(false);
  const [reentriesAllowed, setReentriesAllowed] = useState('');

  // Bounty
  const [isBounty, setIsBounty] = useState(false);
  const [bountyAmount, setBountyAmount] = useState('');

  // Multi-day
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [days, setDays] = useState([]); // [{ label, startTime: Date }]
  const [newDayLabel, setNewDayLabel] = useState('Day 1');
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const [newDayDate, setNewDayDate] = useState(new Date());
  const [useSameStructure, setUseSameStructure] = useState(true);

  // Per-day structure store: { [index]: Array<UILevel> }
  const [dayStructures, setDayStructures] = useState({});
  const [draftDayInputs, setDraftDayInputs] = useState({}); // { [index]: { level, ante, duration } }

  // Global structure
  const [structure, setStructure] = useState([]); // [{ smallBlind,bigBlind,ante?,duration } or { level:'Break',duration }]
  const [newLevel, setNewLevel] = useState('');
  const [newAnte, setNewAnte] = useState('');
  const [newDuration, setNewDuration] = useState('');

  // Helpers
  const handleConfirmMain = (d) => { setDate(d); setPickerVisible(false); };
  const handleConfirmDay = (d) => { setNewDayDate(d); setDayPickerOpen(false); };

  const addDay = () => {
    if (!newDayLabel.trim()) return Alert.alert('Validation', 'Add a day label (e.g., "Day 1A").');
    setDays([...days, { label: newDayLabel.trim(), startTime: newDayDate }]);
    setNewDayLabel(`Day ${days.length + 2}`);
  };
  const removeDay = (idx) => {
    const copy = days.slice(); copy.splice(idx, 1); setDays(copy);
    const ds = { ...dayStructures }; delete ds[idx];
    const newDS = {}; const newDraft = {};
    copy.forEach((_, i) => {
      const oldKey = i >= idx ? i + 1 : i;
      if (dayStructures[oldKey]) newDS[i] = dayStructures[oldKey];
      if (draftDayInputs[oldKey]) newDraft[i] = draftDayInputs[oldKey];
    });
    setDayStructures(newDS); setDraftDayInputs(newDraft);
  };

  // Structure adders (global)
  const addGlobalLevel = () => {
    if (!newLevel || !newDuration) return Alert.alert('Error', 'Enter both level and duration');
    const duration = parseInt(newDuration, 10);
    if (!duration || duration <= 0) return Alert.alert('Format error', 'Duration must be positive');

    if (newLevel.trim().toLowerCase() === 'break') {
      setStructure([...structure, { level: 'Break', duration }]);
    } else {
      const m = newLevel.match(/^(\d+)\s*\/\s*(\d+)$/);
      if (!m) return Alert.alert('Format error', 'Use format like 100/200 or enter "Break"');
      const smallBlind = parseInt(m[1], 10);
      const bigBlind = parseInt(m[2], 10);
      const ante = newAnte ? Number(newAnte) || 0 : 0;
      setStructure([...structure, { smallBlind, bigBlind, ante, duration }]);
    }
    setNewLevel(''); setNewAnte(''); setNewDuration(''); Keyboard.dismiss();
  };

  // Structure adders (per-day)
  const setDraftForDay = (i, patch) =>
    setDraftDayInputs((prev) => ({ ...prev, [i]: { ...(prev[i] || {}), ...patch } }));

  const addDayLevel = (i) => {
    const draft = draftDayInputs[i] || {};
    const { level, ante, duration } = draft;
    if (!level || !duration) return Alert.alert('Error', 'Enter both level and duration for this day');
    const d = parseInt(duration, 10);
    if (!d || d <= 0) return Alert.alert('Format error', 'Duration must be positive');

    const current = dayStructures[i] || [];
    if (String(level).trim().toLowerCase() === 'break') {
      setDayStructures({ ...dayStructures, [i]: [...current, { level: 'Break', duration: d }] });
    } else {
      const m = String(level).match(/^(\d+)\s*\/\s*(\d+)$/);
      if (!m) return Alert.alert('Format error', 'Use format like 100/200 or enter "Break"');
      const sb = parseInt(m[1], 10);
      const bb = parseInt(m[2], 10);
      const a = ante ? Number(ante) || 0 : 0;
      setDayStructures({ ...dayStructures, [i]: [...current, { smallBlind: sb, bigBlind: bb, ante: a, duration: d }] });
    }
    setDraftForDay(i, { level: '', ante: '', duration: '' });
    Keyboard.dismiss();
  };

  // Normalizers
  const normalizeStructure = (arr) =>
    (Array.isArray(arr) ? arr : []).map((s, idx) =>
      (typeof s.level === 'string' && s.level.toLowerCase() === 'break')
        ? { level: 0, smallBlind: 0, bigBlind: 0, ante: 0, durationMinutes: Number(s.duration) || 0, isBreak: true }
        : { level: idx + 1, smallBlind: Number(s.smallBlind) || 0, bigBlind: Number(s.bigBlind) || 0, ante: Number(s.ante) || 0, durationMinutes: Number(s.duration) || 0, isBreak: false }
    );

  const payloadDays = () =>
    isMultiDay
      ? days.map((d, i) => ({
          label: d.label,
          startTimeUTC: d.startTime.toISOString(),
          structure: useSameStructure ? [] : normalizeStructure(dayStructures[i] || []),
        }))
      : [];

  const computeDateTimeUTC = () => {
    if (!isMultiDay || days.length === 0) return date.toISOString();
    const sorted = [...days].sort((a, b) => a.startTime - b.startTime);
    return sorted[0].startTime.toISOString();
  };

  const handleSubmit = async () => {
    if (!name.trim()) return Alert.alert('Validation', 'Please enter a tournament name.');
    if (!buyIn) return Alert.alert('Validation', 'Please enter a buy-in.');
    if (!rake) return Alert.alert('Validation', 'Please enter a rake.');

    const payload = {
      casinoId,
      name: name.trim(),
      dateTimeUTC: computeDateTimeUTC(),
      buyIn: Number(buyIn),
      rake: Number(rake),
      prizePool: prizePool ? Number(prizePool) || 0 : 0, // RESTORED
      gameType,
      notes: notes.trim(),
      startingStack: startingStack ? Number(startingStack) || 0 : 0, // RESTORED
      reEntry: allowReEntry || unlimitedReEntry,
      reEntryUnlimited: unlimitedReEntry,
      reEntryCount: unlimitedReEntry ? 0 : (Number(reentriesAllowed) || 0),
      lateRegLevels: 0,
      bounty: isBounty ? Number(bountyAmount) || 0 : 0,
      structure: useSameStructure ? normalizeStructure(structure) : [],
      days: payloadDays(),
      status: 'scheduled',
    };

    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/casinos/${casinoId}/tournaments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data?.error || 'Failed to save tournament');

      Alert.alert('Success', 'Tournament added!');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.section}>🎯 Basic Info</Text>
        <TextInput style={styles.input} placeholder="Tournament Name" value={name} onChangeText={setName} />

        <View style={styles.chipsRow}>
          {GAME_TYPES.map((gt) => {
            const active = gameType === gt;
            return (
              <TouchableOpacity key={gt} style={[styles.chip, active && styles.chipActive]} onPress={() => setGameType(gt)}>
                <Text style={active ? styles.chipActiveText : styles.chipText}>
                  {gt === 'No Limit Hold’em' ? 'NLH' : gt}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <NumericInput style={styles.input} placeholder="Buy-In (£)" value={buyIn} onChangeText={setBuyIn} />
        <NumericInput style={styles.input} placeholder="Rake (£)" value={rake} onChangeText={setRake} />

        <NumericInput style={styles.input} placeholder="Starting Stack" value={startingStack} onChangeText={setStartingStack} />
        <NumericInput style={styles.input} placeholder="Prize Pool (optional)" value={prizePool} onChangeText={setPrizePool} />

        {!isMultiDay && (
          <>
            <TouchableOpacity onPress={() => setPickerVisible(true)} style={styles.input}>
              <Text>Start Time: {date.toLocaleString()}</Text>
            </TouchableOpacity>
            <DateTimePickerModal
              isVisible={isPickerVisible}
              mode="datetime"
              date={date}
              onConfirm={handleConfirmMain}
              onCancel={() => setPickerVisible(false)}
            />
          </>
        )}

        <Text style={styles.section}>🔁 Re-Entry</Text>
        <View style={styles.row}>
          <Text>Allow re-entry</Text>
          <Switch value={allowReEntry} onValueChange={setAllowReEntry} />
        </View>
        {allowReEntry && (
          <>
            <View style={styles.row}>
              <Text>Unlimited</Text>
              <Switch value={unlimitedReEntry} onValueChange={setUnlimitedReEntry} />
            </View>
            {!unlimitedReEntry && (
              <NumericInput style={styles.input} placeholder="Max re-entries" value={reentriesAllowed} onChangeText={setReentriesAllowed} />
            )}
          </>
        )}

        <Text style={styles.section}>🏆 Bounty</Text>
        <View style={styles.row}>
          <Text>Bounty tournament?</Text>
          <Switch value={isBounty} onValueChange={setIsBounty} />
        </View>
        {isBounty && (
          <NumericInput style={styles.input} placeholder="Bounty Amount (£)" value={bountyAmount} onChangeText={setBountyAmount} />
        )}

        <Text style={styles.section}>📅 Multi-day Event</Text>
        <View style={styles.row}>
          <Text>This is a multi-day event</Text>
          <Switch value={isMultiDay} onValueChange={setIsMultiDay} />
        </View>

        {isMultiDay && (
          <View style={styles.card}>
            <TextInput style={styles.input} placeholder='Day label (e.g. "Day 1A")' value={newDayLabel} onChangeText={setNewDayLabel} />
            <TouchableOpacity onPress={() => setDayPickerOpen(true)} style={styles.input}>
              <Text>Day start: {newDayDate.toLocaleString()}</Text>
            </TouchableOpacity>
            <DateTimePickerModal
              isVisible={dayPickerOpen}
              mode="datetime"
              date={newDayDate}
              onConfirm={handleConfirmDay}
              onCancel={() => setDayPickerOpen(false)}
            />
            <Button title="Add Day" onPress={addDay} />

            <View style={styles.row}>
              <Text>Use same structure for all days</Text>
              <Switch value={useSameStructure} onValueChange={setUseSameStructure} />
            </View>

            {days.length > 0 && (
              <View style={{ marginTop: 10 }}>
                {days.map((d, i) => {
                  const draft = draftDayInputs[i] || {};
                  const list = dayStructures[i] || [];
                  return (
                    <View key={i} style={styles.dayBlock}>
                      <View style={styles.dayHeader}>
                        <Text style={{ fontWeight: '600' }}>{d.label}</Text>
                        <Text> — {d.startTime.toLocaleString()}</Text>
                        <View style={{ flex: 1 }} />
                        <Button title="🗑️" color="#c00" onPress={() => removeDay(i)} />
                      </View>

                      {!useSameStructure && (
                        <>
                          <Text style={{ marginTop: 8, marginBottom: 4 }}>Add level for {d.label}</Text>
                          <TextInput
                            style={styles.input}
                            placeholder='Level (e.g. "100/200" or "Break")'
                            value={draft.level || ''}
                            onChangeText={(t) => setDraftForDay(i, { level: t })}
                          />
                          <NumericInput
                            style={styles.input}
                            placeholder="Ante (optional)"
                            value={draft.ante || ''}
                            onChangeText={(t) => setDraftForDay(i, { ante: t })}
                          />
                          <NumericInput
                            style={styles.input}
                            placeholder="Duration (min)"
                            value={draft.duration || ''}
                            onChangeText={(t) => setDraftForDay(i, { duration: t })}
                          />
                          <Button title={`Add Level to ${d.label}`} onPress={() => addDayLevel(i)} />
                          {list.length > 0 && (
                            <View style={styles.structureList}>
                              {list.map((s, j) => (
                                <Text key={j}>
                                  {s.level || `${s.smallBlind}/${s.bigBlind}`}
                                  {s.ante ? ` (ante ${s.ante})` : ''} – {s.duration} min
                                </Text>
                              ))}
                            </View>
                          )}
                        </>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        <Text style={styles.section}>🧮 Structure (global)</Text>
        <Text style={{ color: '#666', marginBottom: 6 }}>
          {isMultiDay && !useSameStructure
            ? 'Global structure is optional when using per-day structures.'
            : 'Used for the tournament (and all days if multi-day).'}
        </Text>
        <TextInput style={styles.input} placeholder='Level (e.g. "100/200" or "Break")' value={newLevel} onChangeText={setNewLevel} autoCapitalize="none" />
        <NumericInput style={styles.input} placeholder="Ante (optional)" value={newAnte} onChangeText={setNewAnte} />
        <NumericInput style={styles.input} placeholder="Duration (min)" value={newDuration} onChangeText={setNewDuration} />
        <Button title="Add Level" onPress={addGlobalLevel} />
        {structure.length > 0 && (
          <View style={styles.structureList}>
            {structure.map((s, i) => (
              <Text key={i}>
                {s.level || `${s.smallBlind}/${s.bigBlind}`}
                {s.ante ? ` (ante ${s.ante})` : ''} – {s.duration} min
              </Text>
            ))}
          </View>
        )}

        <Text style={styles.section}>📝 More Info</Text>
        <TextInput
          style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
          placeholder="Notes / additional info"
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        <Button title="Submit Tournament" onPress={handleSubmit} />
      </ScrollView>

      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={ACCESSORY_ID}>
          <View style={styles.doneBar}>
            <Button title="Done" onPress={() => Keyboard.dismiss()} />
          </View>
        </InputAccessoryView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff' },
  section: { fontWeight: 'bold', fontSize: 16, marginVertical: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 10, marginBottom: 10 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, borderWidth: 1, borderColor: '#ccc' },
  chipActive: { backgroundColor: '#007aff1a', borderColor: '#007aff' },
  chipText: { color: '#333' },
  chipActiveText: { color: '#007aff', fontWeight: '600' },
  structureList: { marginVertical: 10, backgroundColor: '#f3f3f3', padding: 10, borderRadius: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  card: { backgroundColor: '#f9f9f9', padding: 12, borderRadius: 8, marginBottom: 12 },
  dayBlock: { backgroundColor: '#fff', padding: 10, borderRadius: 8, marginTop: 10, borderWidth: 1, borderColor: '#eee' },
  dayHeader: { flexDirection: 'row', alignItems: 'center' },
  doneBar: { alignItems: 'flex-end', padding: 8, borderTopWidth: 1, borderColor: '#ddd', backgroundColor: '#f9f9f9' },
});
