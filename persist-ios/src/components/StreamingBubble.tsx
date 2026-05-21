import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Theme } from '../theme/themes';

interface Props {
  text: string;
  statusText: string | null;
  t: Theme;
}

export function StreamingBubble({ text, statusText, t }: Props) {
  return (
    <View style={styles.row}>
      <View style={[styles.bubble, { backgroundColor: t.asstBubble, borderColor: t.border }]}>
        {statusText && !text ? (
          <Text style={[styles.status, { color: t.textSec }]}>{statusText}</Text>
        ) : (
          <Text style={[styles.content, { color: t.asstText }]}>{text}</Text>
        )}
        <View style={styles.cursor} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    padding: 10,
    borderRadius: 18,
    borderBottomLeftRadius: 5,
    borderWidth: 0.5,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  content: { fontSize: 14.5, lineHeight: 23, letterSpacing: -0.28 },
  status: { fontSize: 13, fontStyle: 'italic', lineHeight: 20 },
  cursor: {
    width: 2,
    height: 16,
    backgroundColor: '#007aff',
    marginLeft: 2,
    marginBottom: 2,
    borderRadius: 1,
  },
});
