import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppTheme } from '../context/ThemeContext';

import TabNavigator from './TabNavigator';
import VillaDetailsScreen from '../screens/VillaDetailsScreen/VillaDetailsScreen';
import StayDetailsScreen from '../screens/StayDetailsScreen/StayDetailsScreen';
import BookingScreen from '../screens/BookingScreen/BookingScreen';
import CheckoutScreen from '../screens/CheckoutScreen/CheckoutScreen';
import GuestDetailsScreen from '../screens/GuestDetailsScreen/GuestDetailsScreen';
import PaymentScreen from '../screens/PaymentScreen/PaymentScreen';
import BookingConfirmedScreen from '../screens/BookingConfirmedScreen/BookingConfirmedScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { colors: COLORS } = useAppTheme();
  return (
    <Stack.Navigator screenOptions={{ contentStyle: { backgroundColor: COLORS.bgMain } }}>
      {/* 1. Main tabs (Explore, Search, Bookings, Profile) */}
      <Stack.Screen 
        name="MainTabs" 
        component={TabNavigator} 
        options={{ headerShown: false }} 
      />

      {/* 2. Villa Detail Screen (uses its own floating luxury dark header) */}
      <Stack.Screen 
        name="VillaDetail" 
        component={VillaDetailsScreen} 
        options={{ headerShown: false }} 
      />

      {/* 3. Stay Details Screen (Screenshot #7) */}
      <Stack.Screen 
        name="StayDetails" 
        component={StayDetailsScreen} 
        options={{ headerShown: false }} 
      />

      {/* 4. Booking / Checkout Screen */}
      <Stack.Screen 
        name="BookingModal" 
        component={CheckoutScreen} 
        options={{
          headerShown: false,
        }} 
      />

      {/* 5. Guest Details Screen (Screenshot #1) */}
      <Stack.Screen
        name="GuestDetails"
        component={GuestDetailsScreen}
        options={{ headerShown: false }}
      />

      {/* 6. Payment Screen (Screenshot #2) */}
      <Stack.Screen
        name="Payment"
        component={PaymentScreen}
        options={{ headerShown: false }}
      />

      {/* 7. Booking Confirmed Screen (Screenshot #3) */}
      <Stack.Screen
        name="BookingConfirmed"
        component={BookingConfirmedScreen}
        options={{ headerShown: false }}
      />
        
    </Stack.Navigator>
  );
}
