import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal,
  FlatList, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../theme/themes';
import {
  JournalBlock, listBlocks, updateBlock, deleteBlock, searchBlocks,
} from '../api/memory';
import { useAgentStore } from '../stores/agentStore';
import Svg, { Line, Path } from 'react-native-svg';

interface Props {
  t: Theme;
  visible: boolean;
  onClose: () => void;
}

export function MemorySheet({ t, visible, onClose }: Props) {
  const { activeAgentId } = useAgentStore();
  const insets = useSafeAreaInsets();
  const [blocks, setBlocks] = useState<JournalBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    if (!activeAgentId) return;
    setLoading(true);
    try {
      const data = query.trim()
        ? await searchBlocks(activeAgentId, query.trim())
        : await listBlocks(activeAgentId);
      setBlocks(data);
    } catch {
      setBlocks([]);
    } finally {
      setLoading(false);
    }
  }, [activeAgentId, query]);

  useEffect(() => {
    if (visible) { setQuery(''); load(); }
  }, [visible]);

  useEffect(() => {
    const t = setTimeout(() => load(), 400);
    return () => clearTimeout(t);
  }, [query]);

  const handlePin = async (block: JournalBlock) => {
    if (!activeAgentId) return;
    try {
      const updated = await updateBlock(activeAgentId, block.id, {
        always_in_context: !block.always_in_context,
      });
      setBlocks((prev) => prev.map((b) => (b.id === block.id ? updated : b)));
    } catch {}
  };

  const handleDelete = async (blockId: string) => {
    if (!activeAgentId) return;
    try {
      await deleteBlock(activeAgentId, blockId);
      setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    } catch {}
  };

  const pinned = blocks.filter((b) => b.always_in_context);
  const rest = blocks.filter((b) => !b.always_in_context);

  const renderBlock = (block: JournalBlock) => (
    <View
      key={block.id}
      style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}
    >
      <Text style={[styles.cardText, { color: t.text }]}>{block.content}</Text>
      {block.tags.length > 0 && (
        <View style={styles.tags}>
          {block.tags.map((tag) => (
            <View key={tag} style={[styles.tag, { backgroundColor: t.accentPale }]}>
              <Text style={[styles.tagText, { color: t.accent }]}>{tag}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={styles.cardActions}>
        <TouchableOpacity
          onPress={() => handlePin(block)}
          style={[styles.actionBtn, block.always_in_context && { backgroundColor: t.accentPale }]}
          activeOpacity={0.7}
        >
          <Svg width={15} height={15} viewBox="0 0 24 24" fill={block.always_in_context ? t.accent : 'none'}>
            <Path d="M12 17v5" stroke={block.always_in_context ? t.accent : t.textSec} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" stroke={block.always_in_context ? t.accent : t.textSec} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={[styles.actionLabel, { color: block.always_in_context ? t.accent : t.textSec }]}>
            {block.always_in_context ? 'Pinned' : 'Pin'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleDelete(block.id)}
          style={styles.actionBtn}
          activeOpacity={0.7}
        >
          <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
            <Path d="M3 6h18" stroke="#ff453a" strokeWidth="1.8" strokeLinecap="round" />
            <Path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" stroke="#ff453a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" stroke="#ff453a" strokeWidth="1.8" strokeLinecap="round" />
          </Svg>
          <Text style={[styles.actionLabel, { color: '#ff453a' }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: t.sheetBg, borderTopColor: t.border }]}>
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: t.textTer }]} />
          </View>
          <View style={[styles.header, { borderBottomColor: t.border }]}>
            <Text style={[styles.title, { color: t.text }]}>Memory</Text>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: t.surface }]}>
              <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                <Line x1="18" y1="6" x2="6" y2="18" stroke={t.textSec} strokeWidth="2.5" strokeLinecap="round" />
                <Line x1="6" y1="6" x2="18" y2="18" stroke={t.textSec} strokeWidth="2.5" strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={[styles.searchWrap, { borderBottomColor: t.border }]}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search memories…"
              placeholderTextColor="rgba(255,255,255,0.28)"
              style={[styles.searchInput, { backgroundColor: t.surface, borderColor: t.border, color: t.text }]}
            />
          </View>

          {loading ? (
            <ActivityIndicator color={t.accent} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={[...pinned, ...rest]}
              keyExtractor={(b) => b.id}
              contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 24, gap: 10 }}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                pinned.length > 0 ? (
                  <Text style={[styles.sectionTitle, { color: t.textSec }]}>📌 Always in context</Text>
                ) : null
              }
              renderItem={({ item, index }) => {
                const isPinBoundary = !item.always_in_context && index > 0 && blocks[index - 1]?.always_in_context;
                return (
                  <>
                    {isPinBoundary && (
                      <Text style={[styles.sectionTitle, { color: t.textSec, marginTop: 8 }]}>All memories</Text>
                    )}
                    {renderBlock(item)}
                  </>
                );
              }}
              ListEmptyComponent={
                <Text style={[styles.empty, { color: t.textSec }]}>No memory blocks yet.</Text>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: 0.5, height: '80%' },
  handleRow: { alignItems: 'center', paddingTop: 10 },
  handle: { width: 36, height: 4, borderRadius: 2 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 10, borderBottomWidth: 0.5 },
  title: { fontSize: 16, fontWeight: '600', letterSpacing: -0.4 },
  closeBtn: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  searchWrap: { padding: 12, borderBottomWidth: 0.5 },
  searchInput: { borderRadius: 10, borderWidth: 0.5, padding: 10, fontSize: 14 },
  sectionTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 8 },
  card: { borderRadius: 12, borderWidth: 0.5, padding: 12 },
  cardText: { fontSize: 13.5, lineHeight: 20, letterSpacing: -0.2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 },
  tag: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  tagText: { fontSize: 11 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4 },
  actionLabel: { fontSize: 12, fontWeight: '500' },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14 },
});
