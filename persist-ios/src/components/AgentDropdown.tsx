import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable, Modal } from 'react-native';
import { Theme } from '../theme/themes';
import { Agent } from '../api/agents';

interface Props {
  t: Theme;
  visible: boolean;
  agents: Agent[];
  activeId: string | null;
  /** Y position (bottom of pill) where the dropdown anchors */
  topOffset: number;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function AgentDropdown({ t, visible, agents, activeId, topOffset, onSelect, onClose }: Props) {
  return (
    // Modal renders outside the normal view hierarchy — completely above all stacking contexts
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Full-screen dismiss backdrop */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      {/* Menu — no pointerEvents prop, so touches reach the TouchableOpacity items */}
      <View
        style={[
          styles.menu,
          { top: topOffset, backgroundColor: t.surface, borderColor: t.border },
        ]}
      >
        {agents.map((ag, i) => {
          const active = ag.id === activeId;
          return (
            <TouchableOpacity
              key={ag.id}
              onPress={() => { onSelect(ag.id); onClose(); }}
              style={[
                styles.item,
                active && { backgroundColor: t.accentPale },
                i < agents.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: t.border },
              ]}
              activeOpacity={0.7}
            >
              <Text style={[styles.name, { color: active ? t.accent : t.text, fontWeight: active ? '600' : '400' }]}>
                {ag.name}
              </Text>
              <Text style={[styles.desc, { color: t.textSec }]}>{ag.description}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: 'absolute',
    right: 14,
    minWidth: 210,
    borderRadius: 14,
    borderWidth: 0.5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 20,
  },
  item: { padding: 12 },
  name: { fontSize: 14, letterSpacing: -0.3, marginBottom: 2 },
  desc: { fontSize: 11.5 },
});
