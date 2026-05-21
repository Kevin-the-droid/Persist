import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../theme/themes';
import { useSettingsStore } from '../stores/settingsStore';
import { useAgentStore } from '../stores/agentStore';
import Svg, { Line } from 'react-native-svg';

interface Props {
  t: Theme;
  visible: boolean;
  onClose: () => void;
}

type Status = null | 'testing' | 'ok' | 'error';

export function ConnectionSheet({ t, visible, onClose }: Props) {
  const { serverUrl, setServerUrl } = useSettingsStore();
  const { fetchAgents } = useAgentStore();
  const [draft, setDraft] = useState(serverUrl);
  const [status, setStatus] = useState<Status>(null);
  const insets = useSafeAreaInsets();

  // Keep draft in sync if serverUrl changes externally
  React.useEffect(() => { setDraft(serverUrl); }, [serverUrl]);

  const save = (v: string) => {
    setDraft(v);
    setServerUrl(v);
  };

  const testConnection = async () => {
    setStatus('testing');
    try {
      const res = await fetch(`${draft.replace(/\/$/, '')}/api/v1/agents/`, {
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        setStatus('ok');
        // URL works — reload agents so the picker populates immediately
        await fetchAgents();
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[styles.sheet, { backgroundColor: t.sheetBg, borderTopColor: t.border }]}
        >
          {/* Handle */}
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: t.textTer }]} />
          </View>

          {/* Header */}
          <View style={[styles.sheetHeader, { borderBottomColor: t.border }]}>
            <Text style={[styles.sheetTitle, { color: t.text }]}>Server Connection</Text>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: t.surface }]}
            >
              <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                <Line x1="18" y1="6" x2="6" y2="18" stroke={t.textSec} strokeWidth="2.5" strokeLinecap="round" />
                <Line x1="6" y1="6" x2="18" y2="18" stroke={t.textSec} strokeWidth="2.5" strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ gap: 16, paddingBottom: insets.bottom + 24 }}>
            {/* URL input */}
            <View>
              <Text style={[styles.sectionLabel, { color: t.textSec }]}>BACKEND URL</Text>
              <TextInput
                value={draft}
                onChangeText={save}
                placeholder="http://100.x.x.x:8000"
                placeholderTextColor="rgba(255,255,255,0.28)"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={[styles.urlInput, { backgroundColor: t.surface, borderColor: t.border, color: t.text }]}
              />
              <Text style={[styles.hint, { color: t.textSec }]}>
                Tailscale IP, ngrok URL, or localhost for dev.
              </Text>
            </View>

            {/* Test button */}
            <View style={styles.testRow}>
              <TouchableOpacity
                onPress={testConnection}
                style={[styles.testBtn, { backgroundColor: t.accent }]}
                activeOpacity={0.8}
              >
                {status === 'testing'
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.testBtnText}>Test Connection</Text>
                }
              </TouchableOpacity>
              {status === 'ok' && <Text style={[styles.statusText, { color: '#30d158' }]}>✓ Connected</Text>}
              {status === 'error' && <Text style={[styles.statusText, { color: '#ff453a' }]}>✗ Unreachable</Text>}
            </View>

            {/* How to connect guide */}
            <View style={[styles.guideCard, { backgroundColor: t.surface, borderColor: t.border }]}>
              <Text style={[styles.guideTitle, { color: t.textSec }]}>CONNECT FROM ANYWHERE</Text>
              {[
                { name: 'Tailscale', detail: "Install on Mac + iPhone → use your Mac's Tailscale IP", badge: 'recommended' },
                { name: 'ngrok', detail: 'Run: ngrok http 8000 → paste the https URL above', badge: 'quick' },
                { name: 'Cloudflare Tunnel', detail: 'cloudflared tunnel — stable, free, zero port-forwarding', badge: '' },
              ].map((opt, i) => (
                <View key={i} style={[styles.guideRow, i < 2 && { marginBottom: 10 }]}>
                  <View style={[styles.guideDot, { backgroundColor: t.accent }]} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.guideNameRow}>
                      <Text style={[styles.guideName, { color: t.text }]}>{opt.name}</Text>
                      {opt.badge ? (
                        <View style={[styles.badge, { backgroundColor: t.accentPale }]}>
                          <Text style={[styles.badgeText, { color: t.accent }]}>{opt.badge}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.guideDetail, { color: t.textSec }]}>{opt.detail}</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: 0.5, maxHeight: '85%' },
  handleRow: { alignItems: 'center', paddingTop: 10 },
  handle: { width: 36, height: 4, borderRadius: 2 },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, paddingTop: 10, borderBottomWidth: 0.5,
  },
  sheetTitle: { fontSize: 16, fontWeight: '600', letterSpacing: -0.4 },
  closeBtn: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 18, paddingTop: 20 },
  sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 8 },
  urlInput: { borderRadius: 10, borderWidth: 0.5, padding: 10, fontSize: 13, fontFamily: 'Courier New' },
  hint: { fontSize: 11.5, marginTop: 6 },
  testRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  testBtn: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18 },
  testBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  statusText: { fontSize: 13 },
  guideCard: { borderRadius: 12, padding: 14, borderWidth: 0.5 },
  guideTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 10 },
  guideRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  guideDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5, flexShrink: 0 },
  guideNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  guideName: { fontSize: 13, fontWeight: '600' },
  badge: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  badgeText: { fontSize: 10 },
  guideDetail: { fontSize: 12, marginTop: 1 },
});
