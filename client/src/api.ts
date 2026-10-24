import { z } from 'zod';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL;
if (!BASE_URL) throw new Error('EXPO_PUBLIC_API_URL is not set. Copy .env.example to .env.');

// Every failure becomes an ApiError, so screens handle one shape.
const errorBody = z.object({
  error: z.object({ code: z.string(), message: z.string(), request_id: z.string() }),
});

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly requestId: string | null,
    readonly status: number,
  ) {
    super(message);
  }
}

export const tokenResponse = z.object({
  access_token: z.string(),
  refresh_token: z.string().nullable(),
  expires_in: z.number(),
});
export type Tokens = z.infer<typeof tokenResponse>;

export const startResponse = z.object({ session: z.string(), message: z.string() });

export const meResponse = z.object({
  id: z.string(),
  status: z.enum(['onboarding', 'pending_guardian', 'active', 'restricted']),
  created_at: z.string(),
});
export type Me = z.infer<typeof meResponse>;

type Options = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  accessToken?: string | null;
  retried?: boolean;
};

let refreshAccess: (() => Promise<string | null>) | null = null;

export function setAccessRefresher(refresh: () => Promise<string | null>) {
  refreshAccess = refresh;
}

export async function request<T>(path: string, schema: z.ZodType<T>, options: Options = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError('offline', "We can't reach EduLift. Check your connection.", null, 0);
  }

  if (response.status === 204) return schema.parse(undefined);
  const json: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && options.accessToken && refreshAccess && !options.retried) {
      const fresh = await refreshAccess();
      if (fresh) return request(path, schema, { ...options, accessToken: fresh, retried: true });
    }
    const parsed = errorBody.safeParse(json);
    if (parsed.success) {
      const { code, message, request_id } = parsed.data.error;
      throw new ApiError(code, message, request_id, response.status);
    }
    throw new ApiError('unexpected', 'Something went wrong. Please try again.', null, response.status);
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ApiError('unexpected', 'Something went wrong. Please try again.', null, response.status);
  }
  return parsed.data;
}
