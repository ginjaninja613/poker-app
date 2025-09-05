// frontend/screens/RegisterScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  Button,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';
import { useNavigation } from '@react-navigation/native';

const API_BASE = 'http://192.168.0.178:5000';

export default function RegisterScreen() {
  const navigation = useNavigation();

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Role & casino selection
  const [role, setRole] = useState('user'); // 'user' | 'staff'
  const [casinos, setCasinos] = useState([]); // [{label, value}]
  const [selectedCasino, setSelectedCasino] = useState(null);

  // DropDownPicker control
  const [open, setOpen] = useState(false);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch casinos only when needed (when staff is selected and we don't have them yet)
  useEffect(() => {
    const fetchCasinos = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/casinos`);
        const data = await res.json();
        const items = Array.isArray(data)
          ? data.map(c => ({ label: c.name, value: c._id }))
          : [];
        setCasinos(items);
      } catch (e) {
        setError('Failed to load casinos. Try again or register as a user.');
      }
    };

    if (role === 'staff' && casinos.length === 0) {
      fetchCasinos();
    }
    // Close dropdown when switching roles to avoid layout overlap
    setOpen(false);
  }, [role]);

  const handleRegister = async () => {
    try {
      setSubmitting(true);
      setError('');
      setSuccess('');

      const trimmedName = name.trim();
      const trimmedEmail = email.trim();
      const trimmedPassword = password;

      if (!trimmedName || !trimmedEmail || !trimmedPassword) {
        setError('Please fill in name, email, and password.');
        setSubmitting(false);
        return;
      }

      if (role === 'staff' && !selectedCasino) {
        setError('Please select a casino to request staff access.');
        setSubmitting(false);
        return;
      }

      const payload =
        role === 'staff' && selectedCasino
          ? {
              name: trimmedName,
              email: trimmedEmail,
              password: trimmedPassword,
              roleRequest: 'staff',
              requestedCasinoId: selectedCasino,
            }
          : {
              name: trimmedName,
              email: trimmedEmail,
              password: trimmedPassword,
            };

      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Registration failed');
      }

      setSuccess(
        role === 'staff'
          ? 'Registered. Staff access is pending admin approval. You can log in as a regular user now.'
          : (data?.message || 'Registration successful. You can now log in.')
      );

      // Clear form
      setName('');
      setEmail('');
      setPassword('');
      setSelectedCasino(null);
      setRole('user');
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Register</Text>

        <TextInput
          placeholder="Full name"
          value={name}
          onChangeText={setName}
          style={styles.input}
          autoCapitalize="words"
        />

        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
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
            <Text style={[styles.roleChip, role === 'user' && styles.selectedChip]}>User</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setRole('staff')}>
            <Text style={[styles.roleChip, role === 'staff' && styles.selectedChip]}>Staff</Text>
          </TouchableOpacity>
        </View>

       {role === 'staff' && (
      <View style={styles.dropdownWrapper}>
        <DropDownPicker
          placeholder="Select your assigned casino"
          open={open}
          setOpen={setOpen}
          value={selectedCasino}
          setValue={setSelectedCasino}
          items={casinos}
          setItems={setCasinos}
          searchable
          listMode="MODAL"           // ← prevents nested FlatList inside ScrollView
          modalTitle="Select casino"
          zIndex={1000}
          style={styles.dropdown}
          dropDownContainerStyle={styles.dropdownContainer}
        />
      </View>
    )}


        <Button title={submitting ? 'Registering...' : 'Register'} onPress={handleRegister} disabled={submitting} />

        {!!error && <Text style={styles.error}>{error}</Text>}
        {!!success && <Text style={styles.success}>{success}</Text>}

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.loginLink}>
          <Text style={styles.loginLinkText}>Back to Login</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 40,
    backgroundColor: '#fff',
    minHeight: '100%',
  },
  heading: {
    fontSize: 24,
    marginBottom: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d9d9d9',
    marginBottom: 14,
    padding: 12,
    borderRadius: 8,
  },
  roleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  roleChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#007bff',
    borderRadius: 20,
    color: '#007bff',
  },
  selectedChip: {
    backgroundColor: '#007bff',
    color: '#fff',
  },
  dropdownWrapper: {
    zIndex: 1000,
    marginBottom: 16,
  },
  dropdown: {
    borderColor: '#d9d9d9',
  },
  dropdownContainer: {
    borderColor: '#d9d9d9',
  },
  error: {
    color: 'red',
    marginTop: 12,
    textAlign: 'center',
  },
  success: {
    color: 'green',
    marginTop: 12,
    textAlign: 'center',
  },
  loginLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  loginLinkText: {
    color: '#007bff',
    fontWeight: '600',
  },
});
