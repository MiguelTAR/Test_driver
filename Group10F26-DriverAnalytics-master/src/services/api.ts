import { Platform } from 'react-native';
import { getAuthSession, type AuthSession, type AuthUser } from './token-storage';

function defaultApiBaseUrl() {
  if (Platform.OS === 'android') return 'http://10.0.2.2:3001';
  return 'http://127.0.0.1:3001';
}

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || defaultApiBaseUrl();

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  authenticated = true
): Promise<T> {
  const session = authenticated ? await getAuthSession() : null;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(body.error || `API request failed (${response.status})`, response.status);
  }
  return body as T;
}

export function register(fullName: string, email: string, password: string) {
  return request<AuthSession>(
    '/api/auth/register',
    { method: 'POST', body: JSON.stringify({ fullName, email, password }) },
    false
  );
}

export function login(email: string, password: string) {
  return request<AuthSession>(
    '/api/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
    false
  );
}

export function getCurrentUser() {
  return request<AuthUser>('/api/auth/me');
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
