import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';

import { ApiError, codesResponse, newAccountResponse, request, setAccessRefresher, tokenResponse, type Tokens } from './api';
import { forgetTypedMarks } from './marks';
import { forgetRefreshToken, loadRefreshToken, saveRefreshToken, usesCookie } from './tokens';

type Session = {
  status: 'restoring' | 'signed-out' | 'signed-in';
  accessToken: string | null;
  // Returns the recovery codes, shown once.
  register: (username: string, password: string) => Promise<string[]>;
  signIn: (username: string, password: string) => Promise<void>;
  recover: (username: string, code: string, newPassword: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  newRecoveryCodes: (currentPassword: string) => Promise<string[]>;
  tryDemo: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

// Asks for a new access token: the web sends its cookie, phones send the stored token.
async function renew(): Promise<Tokens | null> {
  const refreshToken = await loadRefreshToken();
  if (!usesCookie && !refreshToken) return null;
  const tokens = await request('/v1/auth/refresh', tokenResponse, {
    method: 'POST',
    body: usesCookie ? { use_cookie: true } : { refresh_token: refreshToken },
  });
  await saveRefreshToken(tokens.refresh_token);
  return tokens;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Session['status']>('restoring');
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    setAccessRefresher(async () => {
      try {
        const tokens = await renew();
        setAccessToken(tokens?.access_token ?? null);
        return tokens?.access_token ?? null;
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
      try {
        const tokens = await renew();
        setAccessToken(tokens?.access_token ?? null);
        setStatus(tokens ? 'signed-in' : 'signed-out');
      } catch (error) {
        // Drop rejected tokens; keep them if we're just offline.
        if (error instanceof ApiError && error.status === 401) await forgetRefreshToken();
        setStatus('signed-out');
      }
    })();
  }, []);

  const signedIn = useCallback(async (tokens: Tokens) => {
    await saveRefreshToken(tokens.refresh_token);
    setAccessToken(tokens.access_token);
    setStatus('signed-in');
  }, []);

  const register = useCallback(
    async (username: string, password: string) => {
      const reply = await request('/v1/auth/register', newAccountResponse, {
        method: 'POST',
        body: { username, password, use_cookie: usesCookie },
      });
      await signedIn(reply);
      return reply.recovery_codes;
    },
    [signedIn],
  );

  const signIn = useCallback(
    async (username: string, password: string) => {
      const tokens = await request('/v1/auth/login', tokenResponse, {
        method: 'POST',
        body: { username, password, use_cookie: usesCookie },
      });
      await signedIn(tokens);
    },
    [signedIn],
  );

  const recover = useCallback(
    async (username: string, code: string, newPassword: string) => {
      const tokens = await request('/v1/auth/recover', tokenResponse, {
        method: 'POST',
        body: { username, code, new_password: newPassword, use_cookie: usesCookie },
      });
      await signedIn(tokens);
    },
    [signedIn],
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const tokens = await request('/v1/auth/password', tokenResponse, {
        method: 'POST',
        body: { current_password: currentPassword, new_password: newPassword, use_cookie: usesCookie },
        accessToken,
      });
      await signedIn(tokens);
    },
    [accessToken, signedIn],
  );

  const newRecoveryCodes = useCallback(
    async (currentPassword: string) => {
      const reply = await request('/v1/auth/recovery-codes', codesResponse, {
        method: 'POST',
        body: { current_password: currentPassword },
        accessToken,
      });
      return reply.recovery_codes;
    },
    [accessToken],
  );

  // A fresh sample learner. The server must have the demo switched on.
  const tryDemo = useCallback(async () => {
    const tokens = await request('/v1/auth/demo', tokenResponse, { method: 'POST' });
    setAccessToken(tokens.access_token);
    setStatus('signed-in');
  }, []);

  const signOut = useCallback(async () => {
    const refreshToken = await loadRefreshToken();
    if (accessToken) {
      // Best effort; the phone is cleared either way. The web's cookie is cleared by the API.
      await request('/v1/auth/sign-out', z.undefined(), {
        method: 'POST',
        body: refreshToken ? { refresh_token: refreshToken } : {},
        accessToken,
      }).catch(() => undefined);
    }
    await forgetRefreshToken();
    forgetTypedMarks();
    setAccessToken(null);
    setStatus('signed-out');
  }, [accessToken]);

  const value = useMemo(
    () => ({ status, accessToken, register, signIn, recover, changePassword, newRecoveryCodes, tryDemo, signOut }),
    [status, accessToken, register, signIn, recover, changePassword, newRecoveryCodes, tryDemo, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside SessionProvider');
  return session;
}
