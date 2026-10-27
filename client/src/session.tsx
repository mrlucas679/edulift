import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';

import { ApiError, request, setAccessRefresher, startResponse, tokenResponse } from './api';
import { forgetRefreshToken, loadRefreshToken, saveRefreshToken } from './tokens';

type Session = {
  status: 'restoring' | 'signed-out' | 'signed-in';
  accessToken: string | null;
  // Kept in memory, never in the URL.
  pendingEmail: string | null;
  sendCode: (email: string) => Promise<void>;
  checkCode: (code: string) => Promise<void>;
  createDemoAccount: (email: string, password: string) => Promise<void>;
  signInDemo: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Session['status']>('restoring');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [pending, setPending] = useState<{ email: string; session: string } | null>(null);

  useEffect(() => {
    setAccessRefresher(async () => {
      const refreshToken = await loadRefreshToken();
      if (!refreshToken) return null;
      try {
        const tokens = await request('/v1/auth/refresh', tokenResponse, {
          method: 'POST',
          body: { refresh_token: refreshToken },
        });
        if (tokens.refresh_token) await saveRefreshToken(tokens.refresh_token);
        setAccessToken(tokens.access_token);
        return tokens.access_token;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await forgetRefreshToken();
          setAccessToken(null);
          setStatus('signed-out');
        }
        return null;
      }
    });
  }, []);

  // Restore the session on launch.
  useEffect(() => {
    (async () => {
      const refreshToken = await loadRefreshToken();
      if (!refreshToken) return setStatus('signed-out');
      try {
        const tokens = await request('/v1/auth/refresh', tokenResponse, {
          method: 'POST',
          body: { refresh_token: refreshToken },
        });
        setAccessToken(tokens.access_token);
        setStatus('signed-in');
      } catch (error) {
        // Drop rejected tokens; keep them if we're just offline.
        if (error instanceof ApiError && error.status === 401) await forgetRefreshToken();
        setStatus('signed-out');
      }
    })();
  }, []);

  const sendCode = useCallback(async (email: string) => {
    const started = await request('/v1/auth/start', startResponse, {
      method: 'POST',
      body: { email },
    });
    setPending({ email, session: started.session });
  }, []);

  const checkCode = useCallback(
    async (code: string) => {
      if (!pending) throw new ApiError('code_expired', 'Ask for a new code.', null, 400);
      const tokens = await request('/v1/auth/verify', tokenResponse, {
        method: 'POST',
        body: { email: pending.email, code, session: pending.session },
      });
      if (tokens.refresh_token) await saveRefreshToken(tokens.refresh_token);
      setPending(null);
      setAccessToken(tokens.access_token);
      setStatus('signed-in');
    },
    [pending],
  );

  const authenticateDemo = useCallback(async (action: 'register' | 'login', email: string, password: string) => {
    const tokens = await request(`/v1/auth/demo/${action}`, tokenResponse, {
      method: 'POST',
      body: { email, password },
    });
    if (tokens.refresh_token) await saveRefreshToken(tokens.refresh_token);
    setAccessToken(tokens.access_token);
    setStatus('signed-in');
  }, []);

  const createDemoAccount = useCallback(
    (email: string, password: string) => authenticateDemo('register', email, password),
    [authenticateDemo],
  );
  const signInDemo = useCallback(
    (email: string, password: string) => authenticateDemo('login', email, password),
    [authenticateDemo],
  );

  const signOut = useCallback(async () => {
    const refreshToken = await loadRefreshToken();
    if (refreshToken && accessToken) {
      // Best effort; the phone is cleared either way.
      await request('/v1/auth/sign-out', z.undefined(), {
        method: 'POST',
        body: { refresh_token: refreshToken },
        accessToken,
      }).catch(() => undefined);
    }
    await forgetRefreshToken();
    setAccessToken(null);
    setStatus('signed-out');
  }, [accessToken]);

  const value = useMemo(
    () => ({
      status,
      accessToken,
      pendingEmail: pending?.email ?? null,
      sendCode,
      checkCode,
      createDemoAccount,
      signInDemo,
      signOut,
    }),
    [status, accessToken, pending, sendCode, checkCode, createDemoAccount, signInDemo, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside SessionProvider');
  return session;
}
