import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const AUTH_SESSION_KEY = 'driver-analytics-auth-session';

export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

export async function getAuthSession(): Promise<AuthSession | null> {
  const raw =
    Platform.OS === 'web'
      ? await AsyncStorage.getItem(AUTH_SESSION_KEY)
      : await SecureStore.getItemAsync(AUTH_SESSION_KEY);
  if (!raw) return null;

  const session = JSON.parse(raw) as AuthSession;
  if (!session.token || !session.user?.id) return null;
  return session;
}

export async function saveAuthSession(session: AuthSession): Promise<void> {
  const value = JSON.stringify(session);
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(AUTH_SESSION_KEY, value);
  } else {
    await SecureStore.setItemAsync(AUTH_SESSION_KEY, value);
  }
}

export async function clearAuthSession(): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(AUTH_SESSION_KEY);
  } else {
    await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
  }
}
