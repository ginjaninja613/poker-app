import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const API_BASE =
  Constants?.expoConfig?.extra?.apiBase ||
  "http://192.168.0.178:5000"; // fallback for safety

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

// Attach token on every request
api.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem("token");
    if (token) {
      config.headers = {
        ...(config.headers || {}),
        Authorization: `Bearer ${token}`,
      };
    }
  } catch (_) {}
  return config;
});

// Handle 401s (token expired/invalid)
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err?.response?.status === 401) {
      await AsyncStorage.multiRemove(["token", "role"]);
      // you could also navigate to Login here if you keep a nav ref
    }
    return Promise.reject(err);
  }
);

export default api;
