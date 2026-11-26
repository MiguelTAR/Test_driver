import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { login, register, uploadSamples } from '@/services/api';
import { flush, pendingCount, withClientIds } from '@/hooks/offline-queue';
import {
  clearAuthSession,
  getAuthSession,
  saveAuthSession,
  type AuthUser,
} from '@/services/token-storage';

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  createAccount: (fullName: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getAuthSession()
      .then((session) => setUser(session?.user || null))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const session = await login(email, password);
    await saveAuthSession(session);
    setUser(session.user);
  }, []);

  const createAccount = useCallback(
    async (fullName: string, email: string, password: string) => {
      const session = await register(fullName, email, password);
      await saveAuthSession(session);
      setUser(session.user);
    },
    []
  );

  const signOut = useCallback(async () => {
    const synced = await flush(async (items) => {
      await uploadSamples(withClientIds(items));
    });
    if (!synced && (await pendingCount()) > 0) {
      throw new Error('Pending driving data must sync before signing out.');
    }
    await clearAuthSession();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, createAccount, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
