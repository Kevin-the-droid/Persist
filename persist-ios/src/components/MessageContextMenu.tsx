import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, Clipboard } from 'react-native';
import { Theme } from '../theme/themes';
import { UIMessage } from '../stores/messageStore';

interface Props {
  t: Theme;
  msg: UIMessage;
  visible: boolean;
  onClose: () => void;
  onFork: (msgId: string) => void;
  onDelete: (msgId: string) => void;
}

export function MessageContextMenu({ t, msg, visible, onClose, onFork, onDelete }: Props) {
  const actions = [
    {
      label: 'Copy',
      color: t.text,
      onPress: () => {
        Clipboard.setString(msg.content);
        onClose();
      },
    },
    {
      label: 'Fork',
      color: t.text,
      onPress: () => { onFork(msg.id); onClose(); },
    },
    {
      label: 'Delete',
      color: '#ff453a',
      onPress: () => { onDelete(msg.id); onClose(); },
    },
  ];

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={[styles.menu, { backgroundColor: t.surface, borderColor: t.border }]}>
          {actions.map((a, i) => (
            <TouchableOpacity
              key={i}
              onPress={a.onPress}
              style={[styles.item, i < actions.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: t.border }]}
            >
              <Text style={[styles.label, { color: a.color }]}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menu: {
    borderRadius: 14,
    borderWidth: 0.5,
    overflow: 'hidden',
    minWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  item: { paddingVertical: 14, paddingHorizontal: 20 },
  label: { fontSize: 15, letterSpacing: -0.3 },
});
