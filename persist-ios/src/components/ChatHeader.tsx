import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../theme/themes';
import Svg, { Line, Path } from 'react-native-svg';

interface Props {
  t: Theme;
  title: string;
  agentName: string;
  onMenu: () => void;
  onMemory: () => void;
  /** Called with the Y coordinate (bottom of pill) so the dropdown can anchor below it */
  onAgentPill: (pillBottom: number) => void;
}

function IconMenu({ c }: { c: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Line x1="3" y1="7" x2="21" y2="7" stroke={c} strokeWidth="2" strokeLinecap="round" />
      <Line x1="3" y1="12" x2="21" y2="12" stroke={c} strokeWidth="2" strokeLinecap="round" />
      <Line x1="3" y1="17" x2="21" y2="17" stroke={c} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

function IconBrain({ c }: { c: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ChatHeader({ t, title, agentName, onMenu, onMemory, onAgentPill }: Props) {
  const insets = useSafeAreaInsets();
  const pillRef = useRef<View>(null);

  const handlePillPress = () => {
    pillRef.current?.measure((_x, _y, _w, h, _px, py) => {
      // py = Y of pill top relative to screen; py + h = bottom of pill
      onAgentPill(py + h + 6);
    });
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: t.headerBg, borderBottomColor: t.border, paddingTop: insets.top },
      ]}
    >
      <View style={styles.inner}>
        <TouchableOpacity onPress={onMenu} style={styles.iconBtn} activeOpacity={0.7}>
          <IconMenu c={t.text} />
        </TouchableOpacity>

        <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
          {title}
        </Text>

        {/* Agent pill — measured so dropdown anchors precisely below it */}
        <TouchableOpacity
          ref={pillRef}
          onPress={handlePillPress}
          style={[styles.pill, { backgroundColor: t.accentPale, borderColor: t.accentBorder }]}
          activeOpacity={0.8}
        >
          <View style={[styles.dot, { backgroundColor: t.onlineGreen }]} />
          <Text style={[styles.pillText, { color: t.accent }]} numberOfLines={1}>
            {agentName}
          </Text>
          <Svg width={9} height={6} viewBox="0 0 9 6" fill="none">
            <Path d="M1 1l3.5 3.5L8 1" stroke={t.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>

        <TouchableOpacity onPress={onMemory} style={styles.iconBtn} activeOpacity={0.7}>
          <IconBrain c={t.textSec} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderBottomWidth: 0.5, zIndex: 30 },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  iconBtn: { padding: 4 },
  title: { flex: 1, fontSize: 16, fontWeight: '600', letterSpacing: -0.4 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderWidth: 0.5,
    maxWidth: 130,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 11.5, fontWeight: '500', letterSpacing: -0.1, flexShrink: 1 },
});
