import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Theme } from '../theme/themes';

export function TypingDots({ t }: { t: Theme }) {
  const anims = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const loops = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(anim, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 280, useNativeDriver: true }),
          Animated.delay(360),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);

  return (
    <View style={[styles.wrapper, { backgroundColor: t.asstBubble, borderColor: t.border }]}>
      {anims.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            { backgroundColor: t.textSec },
            {
              transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }],
              opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    borderRadius: 18,
    borderBottomLeftRadius: 5,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderWidth: 0.5,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
