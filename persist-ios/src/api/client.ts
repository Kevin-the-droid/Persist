import * as SecureStore from 'expo-secure-store';

export async function getBaseUrl(): Promise<string> {
  const stored = await SecureStore.getItemAsync('persistServerUrl');
  return (stored ?? 'http://localhost:8000').replace(/\/$/, '');
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/v1${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}
