import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Theme } from '../theme/themes';
import { UIMessage } from '../stores/messageStore';
import { MarkdownContent } from './MarkdownContent';

interface Props {
  msg: UIMessage;
  t: Theme;
  onLongPress?: (msg: UIMessage) => void;
}

export function MessageBubble({ msg, t, onLongPress }: Props) {
  const isUser = msg.role === 'user';
  const isMem = msg.role === 'memory';

  if (isMem) {
    return (
      <View style={[styles.memWrapper, { backgroundColor: t.memBubble, borderColor: t.memBorder }]}>
        <Text style={styles.memEmoji}>💭</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.memLabel, { color: t.memLabel }]}>MEMORY</Text>
          <Text style={[styles.memText, { color: t.memText }]}>{msg.content}</Text>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onLongPress={onLongPress ? () => onLongPress(msg) : undefined}
      delayLongPress={500}
      style={[styles.row, isUser ? styles.rowUser : styles.rowAsst]}
    >
      <View
        style={[
          styles.bubble,
          isUser
            ? [styles.bubbleUser, { backgroundColor: t.userBubble }]
            : [styles.bubbleAsst, { backgroundColor: t.asstBubble, borderColor: t.border }],
        ]}
      >
        {isUser ? (
          <Text style={styles.userText}>{msg.content}</Text>
        ) : (
          <MarkdownContent content={msg.content} isUser={false} t={t} />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'column' },
  rowUser: { alignItems: 'flex-end' },
  rowAsst: { alignItems: 'flex-start' },
  bubble: { maxWidth: '78%', padding: 10 },
  bubbleUser: { borderRadius: 18, borderBottomRightRadius: 5 },
  bubbleAsst: { borderRadius: 18, borderBottomLeftRadius: 5, borderWidth: 0.5 },
  userText: { fontSize: 14.5, lineHeight: 23, color: '#fff', letterSpacing: -0.28 },
  memWrapper: {
    alignSelf: 'flex-start',
    maxWidth: '90%',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    borderRadius: 14,
    padding: 10,
    borderWidth: 0.5,
  },
  memEmoji: { fontSize: 13, marginTop: 1 },
  memLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  memText: { fontSize: 12.5, lineHeight: 19, fontStyle: 'italic' },
});
