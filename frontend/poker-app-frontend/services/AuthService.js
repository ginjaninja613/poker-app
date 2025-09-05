import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "./api";

export async function register(payload) {
  // payload: { name, email, password, role, assignedCasinoId(s) ... }
  const { data } = await api.post("/api/auth/register", payload);
  return data;
}

export async function login(email, password) {
  const { data } = await api.post("/api/auth/login", { email, password });
  // expected: { token, role, assignedCasinoIds?: string[] }
  if (data?.token) await AsyncStorage.setItem("token", data.token);
  if (data?.role) await AsyncStorage.setItem("role", data.role);
  if (data?.assignedCasinoIds)
    await AsyncStorage.setItem(
      "assignedCasinoIds",
      JSON.stringify(data.assignedCasinoIds)
    );
  return data;
}

export async function logout() {
  await AsyncStorage.multiRemove(["token", "role", "assignedCasinoIds"]);
}

export async function getToken() {
  return AsyncStorage.getItem("token");
}

export async function getRole() {
  return AsyncStorage.getItem("role");
}

export async function getAssignedCasinoIds() {
  const raw = await AsyncStorage.getItem("assignedCasinoIds");
  try {
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function isStaffOrAdmin() {
  const role = await getRole();
  return role === "staff" || role === "admin";
}
