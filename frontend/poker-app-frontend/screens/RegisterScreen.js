import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  Button,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

export default function RegisterScreen() {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [casinos, setCasinos] = useState([]);
  const [open, setOpen] = useState(false);
  const [selectedCasino, setSelectedCasino] = useState(null);

  useEffect(() => {
    const fetchCasinos = async () => {
      try {
        const response = await fetch('http://192.168.0.178:5000/api/casinos');
        const data = await response.json();
        const dropdownItems = data.map(c => ({
          label: c.name,
          value: c._id,
        }));
        setCasinos(dropdownItems);
      } catch (err) {
        console.error('Failed to load casinos', err.message);
      }
    };

    if (role === 'staff') {
      fetchCasinos();
    }
  }, [role]);

  const handleRegister = async () => {
    try {
      const payload = {
        email,
        password,
        role,
        ...(role === 'staff' && selectedCasino ? { casinoId: selectedCasino } : {}),

      };
      
      console.log('📤 Registering payload:', payload);

      const response = await fetch('http://192.168.0.178:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Registration failed');

      // ✅ Save role and casinoId to AsyncStorage
      await AsyncStorage.setItem('role', role);
      if (role === 'staff' && selectedCasino) {
        await AsyncStorage.setItem('casinoId', selectedCasino);
      }

      setSuccess('Registration successful. You can now log in.');
      setError('');
      setEmail('');
      setPassword('');
      setSelectedCasino(null);
    } catch (err) {
      setError(err.message);
      setSuccess('');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Register</Text>

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        autoCapitalize="none"
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        style={styles.input}
        secureTextEntry
      />

      <View style={styles.roleContainer}>
        <TouchableOpacity onPress={() => setRole('user')}>
          <Text style={[styles.role, role === 'user' && styles.selected]}>User</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setRole('staff')}>
          <Text style={[styles.role, role === 'staff' && styles.selected]}>Staff</Text>
        </TouchableOpacity>
      </View>

      {role === 'staff' && (
        <DropDownPicker
          placeholder="Select your assigned casino"
          open={open}
          setOpen={setOpen}
          value={selectedCasino}
          setValue={setSelectedCasino}
          items={casinos}
          searchable={true}
          containerStyle={{ marginBottom: 20, width: '100%' }}
          zIndex={1000}
        />
      )}

      <Button title="Register" onPress={handleRegister} />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}

      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.loginLink}>
        <Text style={{ color: '#007bff' }}>Back to Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  heading: {
    fontSize: 24,
    marginBottom: 30,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    marginBottom: 15,
    padding: 10,
    borderRadius: 5,
  },
  roleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  role: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#007bff',
    borderRadius: 5,
    color: '#007bff',
    marginHorizontal: 5,
  },
  selected: {
    backgroundColor: '#007bff',
    color: '#fff',
  },
  error: {
    color: 'red',
    marginTop: 10,
    textAlign: 'center',
  },
  success: {
    color: 'green',
    marginTop: 10,
    textAlign: 'center',
  },
  loginLink: {
    marginTop: 20,
    alignItems: 'center',
  },
});
