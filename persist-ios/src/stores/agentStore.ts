import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Agent, listAgents, updateAgent as apiUpdateAgent } from '../api/agents';

interface AgentState {
  agents: Agent[];
  activeAgentId: string | null;
  fetchError: string | null;
  setActiveAgent: (id: string) => Promise<void>;
  fetchAgents: () => Promise<void>;
  updateAgent: (id: string, patch: Partial<Agent>) => Promise<void>;
}

export const useAgentStore = create<AgentState>((set) => ({
  agents: [],
  activeAgentId: null,
  fetchError: null,

  fetchAgents: async () => {
    set({ fetchError: null });
    try {
      const agents = await listAgents();
      const savedId = await SecureStore.getItemAsync('selectedAgentId');
      const validId =
        savedId && agents.find((a) => a.id === savedId)
          ? savedId
          : (agents[0]?.id ?? null);
      if (validId) await SecureStore.setItemAsync('selectedAgentId', validId);
      set({ agents, activeAgentId: validId });
    } catch (e: any) {
      set({ fetchError: e?.message ?? 'Could not reach backend' });
    }
  },

  setActiveAgent: async (id: string) => {
    await SecureStore.setItemAsync('selectedAgentId', id);
    set({ activeAgentId: id });
  },

  updateAgent: async (id: string, patch: Partial<Agent>) => {
    const updated = await apiUpdateAgent(id, patch);
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? updated : a)),
    }));
  },
}));
