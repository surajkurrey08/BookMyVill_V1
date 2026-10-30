import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEMES } from '../theme/theme';

const ThemeContext = createContext({
  mode: 'light',
  colors: THEMES.light,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState('light');

  useEffect(() => {
    AsyncStorage.getItem('appTheme')
      .then((savedMode) => {
        if (savedMode === 'dark' || savedMode === 'light') setMode(savedMode);
      })
      .catch((error) => console.warn('Could not load saved theme:', error));
  }, []);

  const toggleTheme = async () => {
    const nextMode = mode === 'light' ? 'dark' : 'light';
    setMode(nextMode);
    try {
      await AsyncStorage.setItem('appTheme', nextMode);
    } catch (error) {
      console.warn('Could not save theme:', error);
    }
  };

  const value = useMemo(() => ({ mode, colors: THEMES[mode], toggleTheme }), [mode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
