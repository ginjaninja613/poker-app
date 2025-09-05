import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator, Alert, Keyboard } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login as apiLogin } from '../services/AuthService';
import { useAuth } from '../App';

export default function LoginScreen() {
  const auth = useAuth();
  const [email, setEmail] = useState('admin@test.com');
  const [password, setPassword] = useState('pass123');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (loading) return;
    Keyboard.dismiss();
    setLoading(true);
    try {
      const result = await apiLogin(email.trim(), password); // this already saves token + role
      const user = result?.user || {};
      if (Array.isArray(user.assignedCasinoIds) && user.assignedCasinoIds.length > 0) {
        await AsyncStorage.setItem('casinoId', String(user.assignedCasinoIds[0]));
      } else {
        await AsyncStorage.removeItem('casinoId');
      }
      auth.signIn(); // 🔑 flip UI immediately
    } catch (err) {
      Alert.alert('Login failed', err.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Poker App</Text>
      <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      {loading ? <ActivityIndicator size="large" /> : <Button title="Login" onPress={handleLogin} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 12, marginBottom: 12 },
});
