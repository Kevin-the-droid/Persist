import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, PanResponder, Animated,
} from 'react-native';
import { Theme } from '../theme/themes';
import { Conversation } from '../api/conversations';
import Svg, { Path } from 'react-native-svg';

const DELETE_W = 70;

interface Props {
  conv: Conversation;
  active: boolean;
  t: Theme;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = diffMs / 3600000;
  if (diffH < 1) return 'Just now';
  if (diffH < 24) return `${Math.floor(diffH)}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'Yesterday';
  if (diffD < 7) return `${diffD}d ago`;
  return 'Last week';
}

export function SwipeConvRow({ conv, active, t, onSelect, onDelete }: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [swiped, setSwiped] = useState(false);
  const startX = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 && Math.abs(g.dy) < 20,
      onPanResponderGrant: (_, g) => { startX.current = 0; },
      onPanResponderMove: (_, g) => {
        const dx = Math.min(0, Math.max(g.dx, -DELETE_W));
        translateX.setValue(dx);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -30) {
          Animated.spring(translateX, { toValue: -DELETE_W, useNativeDriver: true }).start();
          setSwiped(true);
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
          setSwiped(false);
        }
      },
    }),
  ).current;

  const closeSwipe = () => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
    setSwiped(false);
  };

  return (
    <View style={styles.container}>
      {/* Delete button behind row */}
      <TouchableOpacity
        style={[styles.deleteBtn, { backgroundColor: '#ff453a' }]}
        onPress={() => onDelete(conv.id)}
        activeOpacity={0.85}
      >
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Path d="M3 6h18" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
          <Path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
        </Svg>
      </TouchableOpacity>

      {/* Sliding row */}
      <Animated.View
        style={[styles.row, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          onPress={() => {
            if (swiped) { closeSwipe(); return; }
            onSelect(conv.id);
          }}
          activeOpacity={0.7}
          style={[
            styles.inner,
            active && { backgroundColor: t.accentPale },
          ]}
        >
          <View style={styles.topRow}>
            <Text
              style={[styles.title, { color: active ? t.accent : t.text, fontWeight: active ? '600' : '400' }]}
              numberOfLines={1}
            >
              {conv.title}
            </Text>
            <Text style={[styles.time, { color: t.textTer }]}>{formatDate(conv.updated_at)}</Text>
          </View>
          <Text style={[styles.count, { color: t.textSec }]}>{conv.message_count} messages</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative', borderRadius: 10, marginBottom: 2, overflow: 'hidden' },
  deleteBtn: {
    position: 'absolute',
    right: 0, top: 0, bottom: 0,
    width: DELETE_W,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { backgroundColor: 'transparent' },
  inner: { borderRadius: 10, padding: 10 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { flex: 1, fontSize: 14.5, letterSpacing: -0.3, marginRight: 8 },
  time: { fontSize: 11, flexShrink: 0 },
  count: { fontSize: 12, marginTop: 2 },
});
