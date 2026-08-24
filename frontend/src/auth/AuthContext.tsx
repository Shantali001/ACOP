import { useMemo, useState } from 'react';

import * as authApi from './api';
import { AuthContext, type AuthContextValue } from './authContextValue';
import type { LoginResponse } from './types';

type StoredSession = LoginResponse;

const storageKey = 'acop.auth.session';

function readStoredSession(): StoredSession | null {
  const rawSession = window.localStorage.getItem(storageKey);

  if (!rawSession) {
    return null;
  }

  try {
    const session = JSON.parse(rawSession) as StoredSession;

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      window.localStorage.removeItem(storageKey);
      return null;
    }

    return session;
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(() => readStoredSession());

  const value = useMemo<AuthContextValue>(
    () => ({
      token: session?.token ?? null,
      user: session?.user ?? null,
      isAuthenticated: Boolean(session),
      login: async (email, password) => {
        const nextSession = await authApi.login(email, password);
        window.localStorage.setItem(storageKey, JSON.stringify(nextSession));
        setSession(nextSession);

        return nextSession.user;
      },
      logout: async () => {
        if (session?.token) {
          await authApi.logout(session.token).catch(() => undefined);
        }

        window.localStorage.removeItem(storageKey);
        setSession(null);
      },
      clearSession: () => {
        window.localStorage.removeItem(storageKey);
        setSession(null);
      },
    }),
    [session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
