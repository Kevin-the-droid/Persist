import { apiFetch } from './client';

export interface Conversation {
  id: string;
  agent_id: string;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export async function listConversations(agentId: string): Promise<Conversation[]> {
  return apiFetch<Conversation[]>(`/conversations/?agent_id=${agentId}`);
}

export async function getConversation(id: string): Promise<Conversation> {
  return apiFetch<Conversation>(`/conversations/${id}`);
}

export async function createConversation(
  agentId: string,
  title: string,
): Promise<Conversation> {
  return apiFetch<Conversation>('/conversations/', {
    method: 'POST',
    body: JSON.stringify({ agent_id: agentId, title }),
  });
}

export async function updateConversationTitle(
  id: string,
  title: string,
): Promise<Conversation> {
  return apiFetch<Conversation>(`/conversations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  });
}

export async function deleteConversation(id: string): Promise<void> {
  await apiFetch<void>(`/conversations/${id}`, { method: 'DELETE' });
}

export async function forkConversation(
  id: string,
  messageId: string,
): Promise<Conversation> {
  return apiFetch<Conversation>(
    `/conversations/${id}/fork/${messageId}`,
    { method: 'POST' },
  );
}
