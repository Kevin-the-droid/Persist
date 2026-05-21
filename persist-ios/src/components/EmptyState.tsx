import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Theme } from '../theme/themes';

const SUGGESTIONS = [
  "What's on your mind?",
  'Catch me up on what we\'ve discussed',
  'Help me plan my day',
  "Let's explore an idea together",
];

interface Props {
  t: Theme;
  agentName: string;
  onPrompt: (text: string) => void;
}

export function EmptyState({ t, agentName, onPrompt }: Props) {
  return (
    <View style={styles.container}>
      {/* Agent orb */}
      <View style={[styles.orb, { backgroundColor: t.accentPale, borderColor: t.accentBorder }]}>
        <View style={[styles.orbInner, { backgroundColor: t.accent }]} />
      </View>

      <Text style={[styles.name, { color: t.text }]}>{agentName}</Text>
      <Text style={[styles.subtitle, { color: t.textSec }]}>
        Ready to chat. Try a suggestion or type anything.
      </Text>

      <View style={styles.chips}>
        {SUGGESTIONS.map((s, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => onPrompt(s)}
            style={[styles.chip, { backgroundColor: t.surface, borderColor: t.border }]}
          >
            <Text style={[styles.chipText, { color: t.text }]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  orb: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  orbInner: { width: 16, height: 16, borderRadius: 8, opacity: 0.85 },
  name: { fontSize: 18, fontWeight: '600', letterSpacing: -0.5, marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: 13, lineHeight: 20, marginBottom: 28, textAlign: 'center' },
  chips: { width: '100%', gap: 8 },
  chip: {
    borderRadius: 12,
    borderWidth: 0.5,
    padding: 12,
  },
  chipText: { fontSize: 13.5, letterSpacing: -0.2, lineHeight: 20 },
});
