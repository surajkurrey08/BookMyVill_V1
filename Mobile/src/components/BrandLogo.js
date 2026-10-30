import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

function MountainMark({ size, color }) {
  const lineWidth = size * 0.92;
  const lineHeight = Math.max(1, size * 0.075);

  return (
    <View
      accessible={false}
      style={[styles.mountain, { width: size * 2.1, height: size * 0.78 }]}
    >
      {[-45, 45, -45, 45].map((rotation, index) => (
        <View
          key={index}
          style={[
            styles.mountainStroke,
            {
              width: lineWidth,
              height: lineHeight,
              backgroundColor: color,
              left: size * (-0.11 + index * 0.53),
              top: size * 0.36,
              transform: [{ rotate: `${rotation}deg` }],
            },
          ]}
        />
      ))}
    </View>
  );
}

export default function BrandLogo({ size = 17, color = '#C49A24', style }) {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="BookMyVilla mountain logo" style={[styles.container, style]}>
      <View style={styles.wordmarkRow}>
        <Text style={[styles.wordmark, { color, fontSize: size }]}>BookMyVilla</Text>
        <MountainMark size={size} color={color} />
      </View>
      <View style={[styles.underline, { backgroundColor: color, width: size * 2.05 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'flex-start' },
  wordmarkRow: { flexDirection: 'row', alignItems: 'center' },
  wordmark: {
    fontFamily: 'serif',
    fontWeight: '900',
    letterSpacing: -0.15,
    textShadowColor: 'rgba(0, 0, 0, 0.82)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  mountain: { marginLeft: 3, overflow: 'visible' },
  mountainStroke: { 
    position: 'absolute', 
    borderRadius: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
  },
  underline: { height: 1.5, marginTop: 2, opacity: 0.9 },
});
