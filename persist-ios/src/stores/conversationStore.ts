import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import {
  Conversation,
  listConversations,
  createConversation as apiCreate,
  deleteConversation as apiDelete,
  forkConversation as apiFork,
} from '../api/conversations';

interface ConversationState {
  conversations: Conversation[];
  activeConvId: string | null;
  fetchConvs: (agentId: string) => Promise<void>;
  selectConv: (id: string) => Promise<void>;
  createConv: (agentId: string, title: string) => Promise<Conversation>;
  deleteConv: (id: string) => Promise<void>;
  forkConv: (id: string, messageId: string) => Promise<Conversation>;
  updateConvInList: (conv: Conversation) => void;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  activeConvId: null,

  fetchConvs: async (agentId: string) => {
    const convs = await listConversations(agentId);
    const savedId = await SecureStore.getItemAsync('currentConversationId');
    const validId =
      savedId && convs.find((c) => c.id === savedId)
        ? savedId
        : (convs[0]?.id ?? null);
    if (validId) await SecureStore.setItemAsync('currentConversationId', validId);
    set({ conversations: convs, activeConvId: validId });
  },

  selectConv: async (id: string) => {
    await SecureStore.setItemAsync('currentConversationId', id);
    set({ activeConvId: id });
  },

  createConv: async (agentId: string, title: string) => {
    const conv = await apiCreate(agentId, title);
    await SecureStore.setItemAsync('currentConversationId', conv.id);
    set((s) => ({
      conversations: [conv, ...s.conversations],
      activeConvId: conv.id,
    }));
    return conv;
  },

  deleteConv: async (id: string) => {
    await apiDelete(id);
    set((s) => {
      const remaining = s.conversations.filter((c) => c.id !== id);
      const nextId = s.activeConvId === id ? (remaining[0]?.id ?? null) : s.activeConvId;
      return { conversations: remaining, activeConvId: nextId };
    });
  },

  forkConv: async (id: string, messageId: string) => {
    const conv = await apiFork(id, messageId);
    await SecureStore.setItemAsync('currentConversationId', conv.id);
    set((s) => ({
      conversations: [conv, ...s.conversations],
      activeConvId: conv.id,
    }));
    return conv;
  },

  updateConvInList: (conv: Conversation) => {
    set((s) => ({
      conversations: s.conversations.map((c) => (c.id === conv.id ? conv : c)),
    }));
  },
}));
