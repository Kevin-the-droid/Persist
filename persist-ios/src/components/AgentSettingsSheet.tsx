import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal,
  ScrollView, Switch,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../theme/themes';
import { useAgentStore } from '../stores/agentStore';
import { Agent } from '../api/agents';
import Svg, { Line } from 'react-native-svg';

interface Props {
  t: Theme;
  visible: boolean;
  onClose: () => void;
}

function Row({ label, note, right }: { label: string; note?: string; right: React.ReactNode }) {
  return (
    <View style={rowStyles.container}>
      <View style={{ flex: 1 }}>
        <Text style={rowStyles.label}>{label}</Text>
        {note && <Text style={rowStyles.note}>{note}</Text>}
      </View>
      {right}
    </View>
  );
}

const rowStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { fontSize: 14, letterSpacing: -0.3, color: '#ebebeb' },
  note: { fontSize: 11, color: 'rgba(235,235,235,0.45)', marginTop: 1 },
});

export function AgentSettingsSheet({ t, visible, onClose }: Props) {
  const { agents, activeAgentId, updateAgent } = useAgentStore();
  const agent = agents.find((a) => a.id === activeAgentId) ?? null;
  const insets = useSafeAreaInsets();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [temp, setTemp] = useState(agent?.temperature ?? 0.7);
  const [topP, setTopP] = useState(agent?.top_p ?? 0.9);
  const [topK, setTopK] = useState(agent?.top_k ?? 50);
  const [maxTok, setMaxTok] = useState(String(agent?.max_output_tokens ?? 8192));
  const [reasoning, setReasoning] = useState(agent?.reasoning_enabled ?? false);
  const [sysInstr, setSysInstr] = useState(agent?.system_instructions ?? '');

  useEffect(() => {
    if (!agent) return;
    setTemp(agent.temperature ?? 0.7);
    setTopP(agent.top_p ?? 0.9);
    setTopK(agent.top_k ?? 50);
    setMaxTok(String(agent.max_output_tokens ?? 8192));
    setReasoning(agent.reasoning_enabled ?? false);
    setSysInstr(agent.system_instructions ?? '');
  }, [agent?.id]);

  const debounce = useCallback((patch: Partial<Agent>) => {
    if (!activeAgentId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateAgent(activeAgentId, patch).catch(() => null);
    }, 800);
  }, [activeAgentId, updateAgent]);

  if (!agent) return null;

  const sep = [styles.section, { borderBottomColor: t.border }];

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: t.sheetBg, borderTopColor: t.border }]}>
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: t.textTer }]} />
          </View>
          <View style={[styles.header, { borderBottomColor: t.border }]}>
            <Text style={[styles.title, { color: t.text }]}>Agent Settings</Text>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: t.surface }]}>
              <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                <Line x1="18" y1="6" x2="6" y2="18" stroke={t.textSec} strokeWidth="2.5" strokeLinecap="round" />
                <Line x1="6" y1="6" x2="18" y2="18" stroke={t.textSec} strokeWidth="2.5" strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
            {/* Agent name */}
            <Text style={[styles.agentName, { color: t.textSec }]}>{agent.name}</Text>

            {/* Temperature */}
            <View style={sep}>
              <Row
                label="Temperature"
                note="Randomness (0 = focused, 2 = creative)"
                right={<Text style={[styles.val, { color: t.accent }]}>{(temp ?? 0).toFixed(2)}</Text>}
              />
              <Slider
                minimumValue={0} maximumValue={2} step={0.01} value={temp}
                onValueChange={(v) => { setTemp(Math.round(v * 100) / 100); debounce({ temperature: v }); }}
                minimumTrackTintColor={t.accent}
                maximumTrackTintColor={t.border}
                thumbTintColor={t.accent}
                style={{ marginTop: 4 }}
              />
            </View>

            {/* Top-P */}
            <View style={sep}>
              <Row
                label="Top P"
                note="Nucleus sampling threshold"
                right={<Text style={[styles.val, { color: t.accent }]}>{(topP ?? 0).toFixed(2)}</Text>}
              />
              <Slider
                minimumValue={0} maximumValue={1} step={0.01} value={topP}
                onValueChange={(v) => { setTopP(Math.round(v * 100) / 100); debounce({ top_p: v }); }}
                minimumTrackTintColor={t.accent}
                maximumTrackTintColor={t.border}
                thumbTintColor={t.accent}
                style={{ marginTop: 4 }}
              />
            </View>

            {/* Top-K */}
            <View style={sep}>
              <Row
                label="Top K"
                note="Candidate tokens to consider"
                right={<Text style={[styles.val, { color: t.accent }]}>{topK}</Text>}
              />
              <Slider
                minimumValue={1} maximumValue={200} step={1} value={topK}
                onValueChange={(v) => { setTopK(Math.round(v)); debounce({ top_k: Math.round(v) }); }}
                minimumTrackTintColor={t.accent}
                maximumTrackTintColor={t.border}
                thumbTintColor={t.accent}
                style={{ marginTop: 4 }}
              />
            </View>

            {/* Max tokens */}
            <View style={sep}>
              <Row
                label="Max Output Tokens"
                right={
                  <TextInput
                    value={maxTok}
                    onChangeText={(v) => {
                      setMaxTok(v);
                      const n = parseInt(v, 10);
                      if (!isNaN(n)) debounce({ max_output_tokens: n });
                    }}
                    keyboardType="number-pad"
                    style={[styles.numInput, { backgroundColor: t.surface, borderColor: t.border, color: t.text }]}
                  />
                }
              />
            </View>

            {/* Reasoning */}
            <View style={sep}>
              <Row
                label="Reasoning"
                note="Extended thinking before response"
                right={
                  <Switch
                    value={reasoning}
                    onValueChange={(v) => { setReasoning(v); debounce({ reasoning_enabled: v }); }}
                    trackColor={{ false: t.surface, true: t.accent }}
                    thumbColor="#fff"
                  />
                }
              />
            </View>

            {/* System instructions */}
            <View>
              <Text style={[styles.sectionLabel, { color: t.textSec }]}>SYSTEM INSTRUCTIONS</Text>
              <TextInput
                value={sysInstr}
                onChangeText={(v) => { setSysInstr(v); debounce({ system_instructions: v }); }}
                multiline
                placeholder="You are a helpful assistant…"
                placeholderTextColor="rgba(255,255,255,0.28)"
                style={[styles.sysInput, { backgroundColor: t.surface, borderColor: t.border, color: t.text }]}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: 0.5, maxHeight: '90%' },
  handleRow: { alignItems: 'center', paddingTop: 10 },
  handle: { width: 36, height: 4, borderRadius: 2 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 10, borderBottomWidth: 0.5 },
  title: { fontSize: 16, fontWeight: '600', letterSpacing: -0.4 },
  closeBtn: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 18, paddingTop: 16, gap: 0 },
  agentName: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 16 },
  section: { paddingBottom: 14, marginBottom: 14, borderBottomWidth: 0.5 },
  val: { fontSize: 13, fontWeight: '600', minWidth: 36, textAlign: 'right' },
  numInput: { borderRadius: 8, borderWidth: 0.5, padding: 6, fontSize: 13, width: 72, textAlign: 'right' },
  sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 8 },
  sysInput: { borderRadius: 10, borderWidth: 0.5, padding: 10, fontSize: 13.5, minHeight: 100, lineHeight: 20 },
});
