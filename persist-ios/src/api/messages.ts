import { apiFetch } from './client';

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  metadata?: {
    memory_narrative?: string;
    partial?: boolean;
    unsaved?: boolean;
  };
}

export async function listMessages(convId: string): Promise<Message[]> {
  return apiFetch<Message[]>(`/conversations/${convId}/messages`);
}

export async function editMessage(
  convId: string,
  msgId: string,
  content: string,
): Promise<Message> {
  return apiFetch<Message>(`/conversations/${convId}/messages/${msgId}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });
}

export async function deleteMessage(
  convId: string,
  msgId: string,
): Promise<void> {
  await apiFetch<void>(`/conversations/${convId}/messages/${msgId}`, {
    method: 'DELETE',
  });
}

export async function regenerateMessage(
  convId: string,
  msgId: string,
): Promise<void> {
  await apiFetch<void>(`/conversations/${convId}/messages/${msgId}/regenerate`, {
    method: 'POST',
  });
}

export async function savePartialMessage(
  convId: string,
  content: string,
): Promise<Message> {
  return apiFetch<Message>(`/conversations/${convId}/save-partial-message`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}
