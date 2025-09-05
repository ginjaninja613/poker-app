import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://192.168.0.178:5000/api/auth';

// Small helper to safely parse JSON (prevents crashes on bad responses)
const parseJson = async (res) => {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error('Server returned invalid JSON');
  }
};

export async function login(email, password) {
  const res = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || `Login failed (${res.status})`);

  await AsyncStorage.multiSet([
    ['token', data.token],
    ['role', data.user?.role || 'user'],
  ]);

  return data;
}

export async function register({ name, email, password, role = 'user', assignedCasinoIds = [] }) {
  const res = await fetch(`${API_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, role, assignedCasinoIds }),
  });

  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || `Register failed (${res.status})`);

  await AsyncStorage.multiSet([
    ['token', data.token],
    ['role', data.user?.role || 'user'],
  ]);

  return data;
}

export async function logout() {
  await AsyncStorage.multiRemove(['token', 'role']);
}

export async function getToken() {
  return AsyncStorage.getItem('token');
}

export async function getUserRole() {
  return AsyncStorage.getItem('role');
}
