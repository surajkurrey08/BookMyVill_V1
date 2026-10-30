import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Production Live Hosted Backend URL
export const PRODUCTION_API_URL = 'https://api.bookmyvilla.online/api';

// Configured URL from Mobile/.env or production fallback
const rawUrl = process.env.EXPO_PUBLIC_API_URL || PRODUCTION_API_URL;
const API_BASE_URL = rawUrl.trim().replace(/\/+$/, '');

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Ignore storage read error
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const msg = error.response?.data?.msg || '';
    // Auto purge session on 401 Unauthorized or 403 Account Suspended/Access Denied
    if (status === 401 || (status === 403 && /suspended|access denied|not active/i.test(msg))) {
      try {
        await AsyncStorage.removeItem('userToken');
        await AsyncStorage.removeItem('userData');
      } catch {
        // Storage cleanup
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
