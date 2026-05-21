import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, FlatList, StyleSheet, Text, KeyboardAvoidingView, Platform,
  AppState,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useSettingsStore } from '../stores/settingsStore';
import { useAgentStore } from '../stores/agentStore';
import { useConversationStore } from '../stores/conversationStore';
import { useMessageStore, UIMessage } from '../stores/messageStore';
import { useStreamStore } from '../stores/streamStore';

import { ChatHeader } from '../components/ChatHeader';
import { ChatInput } from '../components/ChatInput';
import { MessageBubble } from '../components/MessageBubble';
import { TypingDots } from '../components/TypingDots';
import { StreamingBubble } from '../components/StreamingBubble';
import { EmptyState } from '../components/EmptyState';
import { AgentDropdown } from '../components/AgentDropdown';
import { ConversationsDrawer } from '../components/ConversationsDrawer';
import { MemorySheet } from '../components/MemorySheet';
import { AgentSettingsSheet } from '../components/AgentSettingsSheet';
import { ToolsSettingsSheet } from '../components/ToolsSettingsSheet';
import { ConnectionSheet } from '../components/ConnectionSheet';
import { MessageContextMenu } from '../components/MessageContextMenu';

export function ChatScreen() {
  const { theme: t, loadSettings } = useSettingsStore();
  const { agents, activeAgentId, fetchAgents, setActiveAgent, fetchError } = useAgentStore();
  const {
    conversations, activeConvId,
    fetchConvs, selectConv, createConv, deleteConv, forkConv,
  } = useConversationStore();
  const { messagesByConvId, fetchMessages, addMessage, deleteMessage } = useMessageStore();
  const { isStreaming, streamText, statusText, startStream, stopStream } = useStreamStore();

  const [inputText, setInputText] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [agentDropOpen, setAgentDropOpen] = useState(false);
  const [pillBottom, setPillBottom] = useState(120); // fallback, overwritten on first press
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [agentSettingsOpen, setAgentSettingsOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [contextMsg, setContextMsg] = useState<UIMessage | null>(null);

  const listRef = useRef<FlatList>(null);
  const memoryBubbleId = useRef<string | null>(null);

  // Boot sequence
  useEffect(() => {
    (async () => {
      await loadSettings();
      await fetchAgents();
    })();
  }, []);

  // When agent changes, load its conversations
  useEffect(() => {
    if (activeAgentId) fetchConvs(activeAgentId);
  }, [activeAgentId]);

  // When conversation changes, load messages
  useEffect(() => {
    if (activeConvId && !messagesByConvId[activeConvId]) {
      fetchMessages(activeConvId);
    }
  }, [activeConvId]);

  const messages = activeConvId ? (messagesByConvId[activeConvId] ?? []) : [];
  const activeAgent = agents.find((a) => a.id === activeAgentId) ?? null;
  const activeConv = conversations.find((c) => c.id === activeConvId) ?? null;

  const scrollToBottom = () => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  };

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || !activeConvId || isStreaming) return;

    // Create conversation if none exists
    let convId = activeConvId;
    if (!convId && activeAgentId) {
      const conv = await createConv(activeAgentId, text.slice(0, 60));
      convId = conv.id;
    }

    setInputText('');
    memoryBubbleId.current = null;
    scrollToBottom();

    await startStream(
      convId,
      text,
      // onMemory
      (content) => {
        const memId = `mem-stream-${Date.now()}`;
        memoryBubbleId.current = memId;
        addMessage(convId, {
          id: memId,
          conversation_id: convId,
          role: 'memory',
          content,
          created_at: new Date().toISOString(),
        });
        scrollToBottom();
      },
      // onDone
      (userMsg, asstMsg) => {
        // Remove stream memory placeholder if backend returns it attached to message
        addMessage(convId, userMsg as UIMessage);
        addMessage(convId, asstMsg as UIMessage);
        scrollToBottom();
      },
      // onError
      (err) => {
        addMessage(convId, {
          id: `err-${Date.now()}`,
          conversation_id: convId,
          role: 'assistant',
          content: `⚠️ ${err}`,
          created_at: new Date().toISOString(),
        });
        scrollToBottom();
      },
    );
  }, [inputText, activeConvId, activeAgentId, isStreaming]);

  const handleStop = useCallback(async () => {
    if (activeConvId) await stopStream(activeConvId);
  }, [activeConvId]);

  const handlePrompt = useCallback((text: string) => {
    setInputText(text);
  }, []);

  const handleSelectAgent = useCallback(async (id: string) => {
    await setActiveAgent(id);
  }, []);

  const handleSelectConv = useCallback(async (id: string) => {
    await selectConv(id);
  }, []);

  const handleCreateConv = useCallback(async (title: string) => {
    if (!activeAgentId) return;
    await createConv(activeAgentId, title);
  }, [activeAgentId]);

  const handleDeleteConv = useCallback(async (id: string) => {
    await deleteConv(id);
  }, []);

  const handleRefreshConvs = useCallback(async () => {
    if (activeAgentId) await fetchConvs(activeAgentId);
  }, [activeAgentId]);

  const handleForkMsg = useCallback(async (msgId: string) => {
    if (!activeConvId) return;
    await forkConv(activeConvId, msgId);
  }, [activeConvId]);

  const handleDeleteMsg = useCallback(async (msgId: string) => {
    if (!activeConvId) return;
    deleteMessage(activeConvId, msgId);
  }, [activeConvId]);

  const handleSettings = useCallback((screen: 'agent' | 'tools' | 'connection') => {
    setDrawerOpen(false);
    if (screen === 'agent') setAgentSettingsOpen(true);
    else if (screen === 'tools') setToolsOpen(true);
    else setConnectionOpen(true);
  }, []);

  const renderMessage = ({ item }: { item: UIMessage }) => (
    <MessageBubble
      msg={item}
      t={t}
      onLongPress={item.role !== 'memory' ? setContextMsg : undefined}
    />
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <View style={[styles.root, { backgroundColor: t.bg }]}>
          {/* Header */}
          <ChatHeader
            t={t}
            title={activeConv?.title ?? 'Persist'}
            agentName={activeAgent?.name ?? '…'}
            onMenu={() => setDrawerOpen(true)}
            onMemory={() => setMemoryOpen(true)}
            onAgentPill={(bottom) => { setPillBottom(bottom); setAgentDropOpen(true); }}
          />

          {/* Messages */}
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            {messages.length === 0 && !isStreaming ? (
              <View style={styles.emptyWrapper}>
                {fetchError ? (
                  <View style={styles.errorBox}>
                    <Text style={[styles.errorTitle, { color: t.text }]}>Can't reach backend</Text>
                    <Text style={[styles.errorMsg, { color: t.textSec }]}>{fetchError}</Text>
                    <Text style={[styles.errorHint, { color: t.accent }]}
                      onPress={() => setConnectionOpen(true)}>
                      Open Server settings →
                    </Text>
                  </View>
                ) : (
                  <EmptyState
                    t={t}
                    agentName={activeAgent?.name ?? 'Persist'}
                    onPrompt={handlePrompt}
                  />
                )}
              </View>
            ) : (
              <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(m) => m.id}
                renderItem={renderMessage}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={scrollToBottom}
                ListFooterComponent={
                  isStreaming ? (
                    <View style={{ marginTop: 4 }}>
                      {streamText || statusText ? (
                        <StreamingBubble text={streamText} statusText={statusText} t={t} />
                      ) : (
                        <TypingDots t={t} />
                      )}
                    </View>
                  ) : null
                }
              />
            )}

            {/* Input */}
            <ChatInput
              t={t}
              value={inputText}
              onChange={setInputText}
              onSend={handleSend}
              onStop={handleStop}
              isStreaming={isStreaming}
            />
          </KeyboardAvoidingView>

          {/* Overlays / drawers / sheets */}
          <ConversationsDrawer
            t={t}
            visible={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            convs={conversations}
            activeId={activeConvId}
            onSelect={handleSelectConv}
            onConvCreate={handleCreateConv}
            onConvDelete={handleDeleteConv}
            onRefresh={handleRefreshConvs}
            onSettings={handleSettings}
          />

          <MemorySheet
            t={t}
            visible={memoryOpen}
            onClose={() => setMemoryOpen(false)}
          />

          <AgentSettingsSheet
            t={t}
            visible={agentSettingsOpen}
            onClose={() => setAgentSettingsOpen(false)}
          />

          <ToolsSettingsSheet
            t={t}
            visible={toolsOpen}
            onClose={() => setToolsOpen(false)}
          />

          <ConnectionSheet
            t={t}
            visible={connectionOpen}
            onClose={() => setConnectionOpen(false)}
          />

          <AgentDropdown
            t={t}
            visible={agentDropOpen}
            agents={agents}
            activeId={activeAgentId}
            topOffset={pillBottom}
            onSelect={handleSelectAgent}
            onClose={() => setAgentDropOpen(false)}
          />

          {contextMsg && (
            <MessageContextMenu
              t={t}
              msg={contextMsg}
              visible={!!contextMsg}
              onClose={() => setContextMsg(null)}
              onFork={handleForkMsg}
              onDelete={handleDeleteMsg}
            />
          )}
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  emptyWrapper: { flex: 1, marginTop: 100 },
  errorBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 },
  errorTitle: { fontSize: 17, fontWeight: '600', letterSpacing: -0.4 },
  errorMsg: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  errorHint: { fontSize: 14, fontWeight: '500', marginTop: 4 },
  list: {
    paddingTop: 110, // space for header
    paddingHorizontal: 14,
    paddingBottom: 8,
    gap: 9,
  },
});
