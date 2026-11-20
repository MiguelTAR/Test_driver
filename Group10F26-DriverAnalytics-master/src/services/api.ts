import { Platform } from 'react-native';

function defaultApiBaseUrl() {
  if (Platform.OS === 'android') return 'http://10.0.2.2:3001';
  return 'http://127.0.0.1:3001';
}

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || defaultApiBaseUrl();

async function request<T>(path: string, options: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `API request failed (${response.status})`);
  }
  return body as T;
}

export function register(fullName: string, email: string, password: string) {
  return request<{ id: string; fullName: string; email: string }>(
    '/api/auth/register',
    { method: 'POST', body: JSON.stringify({ fullName, email, password }) }
  );
}

export function login(email: string, password: string) {
  return request<{ id: string; fullName: string; email: string }>(
    '/api/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) }
  );
}

export function createSession(id: string, startedAt: number) {
  return request<{ id: string }>('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ id, startedAt }),
  });
}

export function uploadSamples(samples: unknown[]) {
  return request<{ stored: number }>('/api/samples', {
    method: 'POST',
    body: JSON.stringify(samples),
  });
}
