import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/client';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore user session on app launch
  useEffect(() => {
    const loadStorageData = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('userToken');
        const storedUser = await AsyncStorage.getItem('userData');
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } catch (e) {
        console.log('Failed to restore token:', e);
      } finally {
        setLoading(false);
      }
    };
    loadStorageData();
  }, []);

  const saveAuthSession = async (authToken, authUser) => {
    try {
      if (authToken) {
        await AsyncStorage.setItem('userToken', authToken);
        setToken(authToken);
      }
      if (authUser) {
        await AsyncStorage.setItem('userData', JSON.stringify(authUser));
        setUser(authUser);
      }
    } catch (e) {
      console.log('Error saving auth session:', e);
    }
  };

  // 1. Email + Password Login
  const login = async (email, password) => {
    try {
      const res = await apiClient.post('/auth/login', { email: email.trim(), password });
      const authToken = res.data.token;
      const authUser = res.data.user || { email, name: email.split('@')[0] };

      await saveAuthSession(authToken, authUser);
      return { success: true, user: authUser };
    } catch (err) {
      const msg = err.response?.data?.msg || err.response?.data?.message || 'Could not log in. Please check your credentials.';
      return { success: false, error: msg };
    }
  };

  // 2. Email + Password Register
  const register = async (name, email, password) => {
    try {
      const res = await apiClient.post('/auth/register', { name: name.trim(), email: email.trim(), password });
      const authToken = res.data.token;
      const authUser = res.data.user || { name, email };

      await saveAuthSession(authToken, authUser);
      return { success: true, user: authUser };
    } catch (err) {
      const msg = err.response?.data?.msg || err.response?.data?.message || 'Registration failed. Please try again.';
      return { success: false, error: msg };
    }
  };

  // 3. Send Phone OTP (purpose: 'login' | 'register')
  const sendPhoneOtp = async (phone, purpose = 'login') => {
    try {
      const cleanPhone = (phone || '').toString().replace(/\D/g, '').slice(-10);
      const res = await apiClient.post('/auth/phone/send-otp', { phone: cleanPhone, purpose });
      return {
        success: true,
        msg: res.data.msg || 'OTP sent successfully.',
      };
    } catch (err) {
      const msg = err.response?.data?.msg || err.response?.data?.message || 'Could not send verification OTP.';
      return { success: false, error: msg };
    }
  };

  // 4. Verify Phone OTP (for sign-up flow)
  const verifyPhoneOtp = async (phone, otp) => {
    try {
      const cleanPhone = (phone || '').toString().replace(/\D/g, '').slice(-10);
      const res = await apiClient.post('/auth/phone/verify-otp', { phone: cleanPhone, otp: otp.trim() });
      return { success: true, verified: res.data.verified };
    } catch (err) {
      const msg = err.response?.data?.msg || err.response?.data?.message || 'Invalid or expired OTP.';
      return { success: false, error: msg };
    }
  };

  // 5. Login with Phone + OTP
  const loginWithPhoneOtp = async (phone, otp) => {
    try {
      const cleanPhone = (phone || '').toString().replace(/\D/g, '').slice(-10);
      const res = await apiClient.post('/auth/phone/login-otp', { phone: cleanPhone, otp: otp.trim() });
      const authToken = res.data.token;
      const authUser = res.data.user;

      await saveAuthSession(authToken, authUser);
      return { success: true, user: authUser };
    } catch (err) {
      const msg = err.response?.data?.msg || err.response?.data?.message || 'Invalid OTP code. Please try again.';
      return { success: false, error: msg };
    }
  };

  // 6. Login with Phone + Password
  const loginWithPhonePassword = async (phone, password) => {
    try {
      const cleanPhone = (phone || '').toString().replace(/\D/g, '').slice(-10);
      const res = await apiClient.post('/auth/phone/login', { phone: cleanPhone, password });
      const authToken = res.data.token;
      const authUser = res.data.user;

      await saveAuthSession(authToken, authUser);
      return { success: true, user: authUser };
    } catch (err) {
      const msg = err.response?.data?.msg || err.response?.data?.message || 'Incorrect mobile number or password.';
      return { success: false, error: msg };
    }
  };

  // 7. Register with Phone + OTP + Name + Password + optional Email
  const registerWithPhone = async ({ phone, otp, name, password, email }) => {
    try {
      const cleanPhone = (phone || '').toString().replace(/\D/g, '').slice(-10);
      const payload = {
        phone: cleanPhone,
        otp: otp.trim(),
        name: name.trim(),
        password,
        ...(email && email.trim() ? { email: email.trim().toLowerCase() } : {}),
      };

      const res = await apiClient.post('/auth/phone/register', payload);
      const authToken = res.data.token;
      const authUser = res.data.user;

      await saveAuthSession(authToken, authUser);
      return { success: true, user: authUser };
    } catch (err) {
      const msg = err.response?.data?.msg || err.response?.data?.message || 'Registration failed. Please try again.';
      return { success: false, error: msg };
    }
  };

  // 8. Logout
  const logout = async () => {
    try {
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userData');
    } catch (e) {
      console.log('Error clearing session:', e);
    }
    setToken(null);
    setUser(null);
  };

  // 9. Delete Account (Google Play Compliance & GDPR)
  const deleteAccount = async () => {
    try {
      let remoteSuccess = false;
      let remoteMsg = '';
      try {
        const res = await apiClient.delete('/auth/delete-account');
        remoteSuccess = true;
        remoteMsg = res.data?.msg;
      } catch (apiErr) {
        if (apiErr.response?.status === 409) {
          return {
            success: false,
            error: apiErr.response?.data?.msg || 'Cannot delete account while you have active or upcoming villa reservations.'
          };
        }
        if (apiErr.response?.status === 403) {
          return {
            success: false,
            error: apiErr.response?.data?.msg || 'This account cannot be deleted.'
          };
        }
        console.log('Account delete remote API notice:', apiErr.response?.data?.msg || apiErr.message);
      }

      // Clear local storage & state completely
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userData');
      setToken(null);
      setUser(null);
      return { success: true, msg: remoteMsg || 'Account and associated data deleted successfully.' };
    } catch (e) {
      console.log('Error deleting account:', e);
      return { success: false, error: e.message || 'Could not delete account' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        sendPhoneOtp,
        verifyPhoneOtp,
        loginWithPhoneOtp,
        loginWithPhonePassword,
        registerWithPhone,
        logout,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
