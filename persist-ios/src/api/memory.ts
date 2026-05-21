import { apiFetch } from './client';

export interface JournalBlock {
  id: string;
  agent_id: string;
  content: string;
  tags: string[];
  always_in_context: boolean;
  created_at: string;
  updated_at: string;
}

export async function listBlocks(agentId: string): Promise<JournalBlock[]> {
  return apiFetch<JournalBlock[]>(`/agents/${agentId}/journal-blocks`);
}

export async function updateBlock(
  agentId: string,
  blockId: string,
  patch: Partial<JournalBlock>,
): Promise<JournalBlock> {
  return apiFetch<JournalBlock>(
    `/agents/${agentId}/journal-blocks/${blockId}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
  );
}

export async function deleteBlock(
  agentId: string,
  blockId: string,
): Promise<void> {
  await apiFetch<void>(`/agents/${agentId}/journal-blocks/${blockId}`, {
    method: 'DELETE',
  });
}

export async function searchBlocks(
  agentId: string,
  query: string,
): Promise<JournalBlock[]> {
  return apiFetch<JournalBlock[]>(
    `/agents/${agentId}/journal-blocks/search?q=${encodeURIComponent(query)}`,
  );
}
