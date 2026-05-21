import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../theme/themes';
import { useAgentStore } from '../stores/agentStore';
import Svg, { Line } from 'react-native-svg';

const TOOLS = [
  { id: 'websearch',      label: 'Web Search',     note: 'Real-time web search' },
  { id: 'filebrowser',   label: 'File Browser',   note: 'Access local files' },
  { id: 'codeexec',      label: 'Code Executor',  note: 'Run code snippets' },
  { id: 'calendar',      label: 'Calendar',       note: 'Read calendar events' },
  { id: 'rag',           label: 'RAG Retrieval',  note: 'Search document embeddings' },
  { id: 'memory',        label: 'Memory Agent',   note: 'Persist memories across sessions' },
  { id: 'router_logging',label: 'Router Logging', note: 'Log all requests and responses' },
];

interface Props {
  t: Theme;
  visible: boolean;
  onClose: () => void;
}

export function ToolsSettingsSheet({ t, visible, onClose }: Props) {
  const { agents, activeAgentId, updateAgent } = useAgentStore();
  const agent = agents.find((a) => a.id === activeAgentId) ?? null;
  const insets = useSafeAreaInsets();

  const [enabled, setEnabled] = useState<string[]>(agent?.enabled_tools ?? []);

  useEffect(() => {
    if (agent) setEnabled(agent.enabled_tools ?? []);
  }, [agent?.id]);

  const toggle = async (toolId: string) => {
    if (!activeAgentId) return;
    const next = enabled.includes(toolId)
      ? enabled.filter((t) => t !== toolId)
      : [...enabled, toolId];
    setEnabled(next);
    await updateAgent(activeAgentId, { enabled_tools: next }).catch(() => null);
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: t.sheetBg, borderTopColor: t.border }]}>
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: t.textTer }]} />
          </View>
          <View style={[styles.header, { borderBottomColor: t.border }]}>
            <Text style={[styles.title, { color: t.text }]}>Tools Settings</Text>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: t.surface }]}>
              <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                <Line x1="18" y1="6" x2="6" y2="18" stroke={t.textSec} strokeWidth="2.5" strokeLinecap="round" />
                <Line x1="6" y1="6" x2="18" y2="18" stroke={t.textSec} strokeWidth="2.5" strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
            {TOOLS.map((tool, i) => (
              <View
                key={tool.id}
                style={[
                  styles.row,
                  { borderBottomColor: t.border },
                  i === TOOLS.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.toolLabel, { color: t.text }]}>{tool.label}</Text>
                  <Text style={[styles.toolNote, { color: t.textSec }]}>{tool.note}</Text>
                </View>
                <Switch
                  value={enabled.includes(tool.id)}
                  onValueChange={() => toggle(tool.id)}
                  trackColor={{ false: t.surface, true: t.accent }}
                  thumbColor="#fff"
                />
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: 0.5, maxHeight: '80%' },
  handleRow: { alignItems: 'center', paddingTop: 10 },
  handle: { width: 36, height: 4, borderRadius: 2 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 10, borderBottomWidth: 0.5 },
  title: { fontSize: 16, fontWeight: '600', letterSpacing: -0.4 },
  closeBtn: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 18, paddingTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 0.5 },
  toolLabel: { fontSize: 14.5, letterSpacing: -0.3, marginBottom: 2 },
  toolNote: { fontSize: 12 },
});
