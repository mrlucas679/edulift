import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';

import { ApiError, request, startResponse, tokenResponse } from './api';
import { forgetRefreshToken, loadRefreshToken, saveRefreshToken } from './tokens';

type Session = {
  status: 'restoring' | 'signed-out' | 'signed-in';
  accessToken: string | null;
  // The email we just sent a code to. Kept in memory, never in the URL.
  pendingEmail: string | null;
  sendCode: (email: string) => Promise<void>;
  checkCode: (code: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Session['status']>('restoring');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [pending, setPending] = useState<{ email: string; session: string } | null>(null);

  // On launch, swap a saved refresh token for a fresh access token if we have one.
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
        // A rejected token is dead, so drop it. If we're just offline, keep it for next time.
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

  const signOut = useCallback(async () => {
    const refreshToken = await loadRefreshToken();
    if (refreshToken && accessToken) {
      // Best effort. Even if the server can't be reached we still clear the phone.
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
      signOut,
    }),
    [status, accessToken, pending, sendCode, checkCode, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside SessionProvider');
  return session;
}
