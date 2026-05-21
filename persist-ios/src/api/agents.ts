import { apiFetch } from './client';

export interface Agent {
  id: string;
  name: string;
  description: string;
  model_path: string;
  adapter_path?: string;
  system_instructions: string;
  reasoning_enabled: boolean;
  temperature: number;
  seed?: number;
  max_output_tokens_enabled: boolean;
  max_output_tokens: number;
  top_p?: number;
  top_k?: number;
  embedding_model_path: string;
  embedding_dimensions: number;
  embedding_chunk_size: number;
  enabled_tools: string[];
  is_template: boolean;
}

export async function listAgents(): Promise<Agent[]> {
  const agents = await apiFetch<Agent[]>('/agents/');
  return agents.filter((a) => !a.is_template);
}

export async function getAgent(id: string): Promise<Agent> {
  return apiFetch<Agent>(`/agents/${id}`);
}

export async function updateAgent(
  id: string,
  patch: Partial<Agent>,
): Promise<Agent> {
  return apiFetch<Agent>(`/agents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function cloneAgent(id: string): Promise<Agent> {
  return apiFetch<Agent>(`/agents/${id}/clone`, { method: 'POST' });
}
