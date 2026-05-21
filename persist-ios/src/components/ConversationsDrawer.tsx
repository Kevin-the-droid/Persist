import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  TextInput, ScrollView, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../theme/themes';
import { Conversation } from '../api/conversations';
import { SwipeConvRow } from './SwipeConvRow';
import Svg, { Line, Path } from 'react-native-svg';

const DRAWER_W = 298;

interface Props {
  t: Theme;
  visible: boolean;
  onClose: () => void;
  convs: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onConvCreate: (title: string) => void;
  onConvDelete: (id: string) => void;
  onRefresh: () => Promise<void>;
  onSettings: (screen: 'agent' | 'tools' | 'connection') => void;
}

export function ConversationsDrawer({
  t, visible, onClose, convs, activeId,
  onSelect, onConvCreate, onConvDelete, onRefresh, onSettings,
}: Props) {
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(-DRAWER_W)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const inputRef = useRef<TextInput>(null);

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: visible ? 0 : -DRAWER_W,
        damping: 22,
        stiffness: 180,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible]);

  const handleCreate = () => {
    const title = newTitle.trim() || 'New Conversation';
    onConvCreate(title);
    setNewTitle('');
    setIsCreating(false);
    onClose();
  };

  const startCreating = () => {
    setIsCreating(true);
    setNewTitle('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh().catch(() => null);
    setRefreshing(false);
  };

  return (
    <>
      {/* Overlay */}
      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        style={[styles.overlay, { backgroundColor: t.overlay, opacity }]}
      >
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      {/* Drawer */}
      <Animated.View
        style={[
          styles.drawer,
          {
            backgroundColor: t.drawerBg,
            borderRightColor: t.border,
            width: DRAWER_W,
            transform: [{ translateX }],
          },
        ]}
      >
        {/* Header */}
        <View style={[styles.drawerHeader, { paddingTop: insets.top + 16 }]}>
          <View style={styles.drawerTitleRow}>
            <Text style={[styles.drawerTitle, { color: t.text }]}>Chats</Text>
            <TouchableOpacity
              onPress={startCreating}
              style={[styles.addBtn, { backgroundColor: t.surface }]}
              activeOpacity={0.7}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Line x1="12" y1="5" x2="12" y2="19" stroke={t.accent} strokeWidth="2.5" strokeLinecap="round" />
                <Line x1="5" y1="12" x2="19" y2="12" stroke={t.accent} strokeWidth="2.5" strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          </View>

          {isCreating && (
            <View style={[styles.createRow, { backgroundColor: t.surface, borderColor: `${t.accent}44` }]}>
              <TextInput
                ref={inputRef}
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="Conversation title…"
                placeholderTextColor="rgba(255,255,255,0.28)"
                returnKeyType="done"
                onSubmitEditing={handleCreate}
                style={[styles.createInput, { color: t.text }]}
              />
              <TouchableOpacity
                onPress={handleCreate}
                style={[styles.addConfirmBtn, { backgroundColor: t.accent }]}
              >
                <Text style={styles.addConfirmText}>Add</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setIsCreating(false)} style={{ padding: 2 }}>
                <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                  <Line x1="18" y1="6" x2="6" y2="18" stroke={t.textSec} strokeWidth="2.5" strokeLinecap="round" />
                  <Line x1="6" y1="6" x2="18" y2="18" stroke={t.textSec} strokeWidth="2.5" strokeLinecap="round" />
                </Svg>
              </TouchableOpacity>
            </View>
          )}

          <View style={[styles.divider, { backgroundColor: t.border }]} />
        </View>

        {/* Conv list */}
        <ScrollView
          style={styles.list}
          contentContainerStyle={{ padding: 8, paddingBottom: 4 }}
          showsVerticalScrollIndicator={false}
          onScrollEndDrag={handleRefresh}
        >
          {refreshing && (
            <ActivityIndicator color={t.accent} style={{ marginBottom: 8 }} />
          )}
          {convs.map((conv) => (
            <SwipeConvRow
              key={conv.id}
              conv={conv}
              active={conv.id === activeId}
              t={t}
              onSelect={(id) => { onSelect(id); onClose(); }}
              onDelete={onConvDelete}
            />
          ))}
        </ScrollView>

        {/* Footer settings */}
        <View style={[styles.footer, { borderTopColor: t.border, paddingBottom: insets.bottom + 8 }]}>
          {([
            { label: 'Agent Settings', icon: '⚙️', screen: 'agent' },
            { label: 'Tools Settings', icon: '🔧', screen: 'tools' },
            { label: 'Server', icon: '🌐', screen: 'connection' },
          ] as const).map((item) => (
            <TouchableOpacity
              key={item.screen}
              onPress={() => onSettings(item.screen)}
              style={styles.footerItem}
              activeOpacity={0.7}
            >
              <Text style={styles.footerIcon}>{item.icon}</Text>
              <Text style={[styles.footerLabel, { color: t.textSec }]}>{item.label}</Text>
              <Svg width={7} height={12} viewBox="0 0 7 12" fill="none" style={{ marginLeft: 'auto' }}>
                <Path d="M1 1l5 5-5 5" stroke={t.textTer} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 50,
  },
  drawer: {
    position: 'absolute',
    top: 0, left: 0, bottom: 0,
    zIndex: 55,
    borderRightWidth: 0.5,
    flexDirection: 'column',
  },
  drawerHeader: { paddingHorizontal: 14 },
  drawerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
  },
  drawerTitle: { fontSize: 24, fontWeight: '700', letterSpacing: -0.6 },
  addBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    marginBottom: 10,
  },
  createInput: { flex: 1, fontSize: 13.5, letterSpacing: -0.2 },
  addConfirmBtn: { borderRadius: 7, paddingHorizontal: 9, paddingVertical: 3 },
  addConfirmText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  divider: { height: 0.5, marginBottom: 6 },
  list: { flex: 1 },
  footer: { borderTopWidth: 0.5, paddingHorizontal: 8, paddingTop: 8, gap: 2 },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    padding: 10,
  },
  footerIcon: { fontSize: 16 },
  footerLabel: { fontSize: 14, letterSpacing: -0.3 },
});
