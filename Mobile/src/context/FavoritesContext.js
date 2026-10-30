import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FavoritesContext = createContext({ favorites: [], isFavorite: () => false, toggleFavorite: () => {} });

export function FavoritesProvider({ children }) {
  const [favorites, setFavorites] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('savedVillas')
      .then((stored) => {
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) setFavorites(parsed);
        }
      })
      .catch((error) => console.warn('Could not load saved villas:', error))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (loaded) {
      AsyncStorage.setItem('savedVillas', JSON.stringify(favorites)).catch((error) => {
        console.warn('Could not save villa wishlist:', error);
      });
    }
  }, [favorites, loaded]);

  const toggleFavorite = (villa) => {
    const id = villa?._id || villa?.id;
    if (!id) return;

    setFavorites((current) => current.some((item) => (item._id || item.id) === id)
        ? current.filter((item) => (item._id || item.id) !== id)
        : [...current, villa]);
  };

  const isFavorite = (id) => favorites.some((villa) => (villa._id || villa.id) === id);
  const value = useMemo(() => ({ favorites, isFavorite, toggleFavorite }), [favorites]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
