import { create } from 'zustand';
import { Message, listMessages } from '../api/messages';

// UI messages can include a synthetic 'memory' role for narrative bubbles
export interface UIMessage extends Omit<Message, 'role'> {
  role: 'user' | 'assistant' | 'system' | 'memory';
}

interface MessageState {
  messagesByConvId: Record<string, UIMessage[]>;
  fetchMessages: (convId: string) => Promise<void>;
  setMessages: (convId: string, msgs: UIMessage[]) => void;
  addMessage: (convId: string, msg: UIMessage) => void;
  updateMessage: (convId: string, msgId: string, patch: Partial<UIMessage>) => void;
  deleteMessage: (convId: string, msgId: string) => void;
  clearConv: (convId: string) => void;
}

export const useMessageStore = create<MessageState>((set) => ({
  messagesByConvId: {},

  fetchMessages: async (convId: string) => {
    const msgs = await listMessages(convId);
    // Expand memory_narrative metadata into synthetic memory bubbles
    const expanded: UIMessage[] = [];
    for (const m of msgs) {
      if (m.metadata?.memory_narrative) {
        expanded.push({
          id: `mem-${m.id}`,
          conversation_id: convId,
          role: 'memory',
          content: m.metadata.memory_narrative,
          created_at: m.created_at,
        });
      }
      expanded.push(m as UIMessage);
    }
    set((s) => ({
      messagesByConvId: { ...s.messagesByConvId, [convId]: expanded },
    }));
  },

  setMessages: (convId, msgs) =>
    set((s) => ({
      messagesByConvId: { ...s.messagesByConvId, [convId]: msgs },
    })),

  addMessage: (convId, msg) =>
    set((s) => ({
      messagesByConvId: {
        ...s.messagesByConvId,
        [convId]: [...(s.messagesByConvId[convId] ?? []), msg],
      },
    })),

  updateMessage: (convId, msgId, patch) =>
    set((s) => ({
      messagesByConvId: {
        ...s.messagesByConvId,
        [convId]: (s.messagesByConvId[convId] ?? []).map((m) =>
          m.id === msgId ? { ...m, ...patch } : m,
        ),
      },
    })),

  deleteMessage: (convId, msgId) =>
    set((s) => ({
      messagesByConvId: {
        ...s.messagesByConvId,
        [convId]: (s.messagesByConvId[convId] ?? []).filter(
          (m) => m.id !== msgId && m.id !== `mem-${msgId}`,
        ),
      },
    })),

  clearConv: (convId) =>
    set((s) => ({
      messagesByConvId: { ...s.messagesByConvId, [convId]: [] },
    })),
}));
