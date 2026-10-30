import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function SplashScreen({ onFinish }) {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const glowAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    // 1. Entrance animation (fade in & scale up)
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Glow pulse loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.45,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 3. Transition to main app after 2.2 seconds
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }).start(() => {
        if (onFinish) onFinish();
      });
    }, 2200);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <Animated.View style={[styles.contentWrap, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <Image 
          source={require('../../../assets/splash-icon.png')} 
          style={styles.splashImage}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Footer loading indicator - dynamically safe above Android navigation bar */}
      <View style={[styles.footer, { bottom: Math.max(insets.bottom + 16, 36) }]}>
        <View style={styles.loadingBarTrack}>
          <Animated.View style={[styles.loadingBarFill, { opacity: glowAnim }]} />
        </View>
        <Text style={styles.footerVersion}>VERSION 1.0  •  EXPERIENCE LUXURY</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FCFDF8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 24,
  },
  splashImage: {
    width: Math.min(width * 0.88, 360),
    height: Math.min(width * 0.88, 360),
  },
  footer: {
    position: 'absolute',
    alignItems: 'center',
  },
  loadingBarTrack: {
    width: 140,
    height: 2.5,
    backgroundColor: 'rgba(152, 112, 15, 0.16)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  loadingBarFill: {
    width: '100%',
    height: '100%',
    backgroundColor: '#98700F',
  },
  footerVersion: {
    fontSize: 9,
    fontWeight: '700',
    color: '#98700F',
    letterSpacing: 1.5,
  },
});

