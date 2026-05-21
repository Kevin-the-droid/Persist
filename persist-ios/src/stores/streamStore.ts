import { create } from 'zustand';
import EventSource from 'react-native-sse';
import { getBaseUrl } from '../api/client';
import { savePartialMessage } from '../api/messages';
import { UIMessage } from './messageStore';

interface StreamState {
  isStreaming: boolean;
  streamText: string;
  statusText: string | null; // "Loading model…" etc.
  _es: EventSource | null;
  startStream: (
    convId: string,
    text: string,
    onMemory: (content: string) => void,
    onDone: (userMsg: UIMessage, asstMsg: UIMessage) => void,
    onError: (err: string) => void,
  ) => Promise<void>;
  stopStream: (convId: string) => Promise<void>;
}

export const useStreamStore = create<StreamState>((set, get) => ({
  isStreaming: false,
  streamText: '',
  statusText: null,
  _es: null,

  startStream: async (convId, text, onMemory, onDone, onError) => {
    // Close any existing stream
    get()._es?.close();

    const base = await getBaseUrl();
    const url = `${base}/api/v1/conversations/${convId}/chat/stream?message=${encodeURIComponent(text)}&_t=${Date.now()}`;

    const es = new EventSource(url);
    set({ isStreaming: true, streamText: '', statusText: null, _es: es });

    es.addEventListener('message', (e: any) => {
      if (!e.data) return;
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'memory_narrative') {
          onMemory(data.content as string);
        } else if (data.type === 'status') {
          set({ statusText: data.content as string });
        } else if (data.type === 'content') {
          set((s) => ({
            streamText: s.streamText + (data.content as string),
            statusText: null,
          }));
        } else if (data.type === 'done') {
          es.close();
          set({ isStreaming: false, streamText: '', statusText: null, _es: null });
          onDone(data.user_message as UIMessage, data.assistant_message as UIMessage);
        } else if (data.type === 'error') {
          es.close();
          set({ isStreaming: false, streamText: '', statusText: null, _es: null });
          onError(data.error as string);
        }
      } catch {
        // non-JSON line, ignore
      }
    });

    es.addEventListener('error', () => {
      es.close();
      set({ isStreaming: false, streamText: '', statusText: null, _es: null });
      onError('Connection lost');
    });
  },

  stopStream: async (convId: string) => {
    const { _es, streamText } = get();
    _es?.close();
    const partial = streamText;
    set({ isStreaming: false, streamText: '', statusText: null, _es: null });
    if (partial.trim()) {
      await savePartialMessage(convId, partial).catch(() => null);
    }
  },
}));
