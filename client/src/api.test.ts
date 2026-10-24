import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ApiError, request, setAccessRefresher } from './api';

const body = z.object({ ok: z.boolean() });

function reply(status: number, json: unknown = {}) {
  return new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  setAccessRefresher(async () => null);
});

describe('request', () => {
  it('returns the parsed body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply(200, { ok: true })));
    expect(await request('/v1/x', body)).toEqual({ ok: true });
  });

  it('turns an error body into an ApiError', async () => {
    const error = { error: { code: 'nope', message: 'No.', request_id: 'abc' } };
    vi.stubGlobal('fetch', vi.fn(async () => reply(403, error)));
    await expect(request('/v1/x', body)).rejects.toMatchObject({ code: 'nope', status: 403 });
  });

  it('reports offline when the network fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('down'))));
    await expect(request('/v1/x', body)).rejects.toBeInstanceOf(ApiError);
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(reply(401, { error: { code: 'expired', message: 'x', request_id: 'r' } }))
      .mockResolvedValueOnce(reply(200, { ok: true }));
    vi.stubGlobal('fetch', fetch);
    setAccessRefresher(async () => 'fresh');

    expect(await request('/v1/x', body, { accessToken: 'old' })).toEqual({ ok: true });
    expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer fresh');
  });

  it('gives up after one refresh if the retry is also refused', async () => {
    const fetch = vi.fn(async () => reply(401, { error: { code: 'expired', message: 'x', request_id: 'r' } }));
    vi.stubGlobal('fetch', fetch);
    setAccessRefresher(async () => 'fresh');

    await expect(request('/v1/x', body, { accessToken: 'old' })).rejects.toMatchObject({ status: 401 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not refresh when there is no access token to replace', async () => {
    const fetch = vi.fn(async () => reply(401, { error: { code: 'x', message: 'x', request_id: 'r' } }));
    vi.stubGlobal('fetch', fetch);
    const refresh = vi.fn(async () => 'fresh');
    setAccessRefresher(refresh);

    await expect(request('/v1/x', body)).rejects.toMatchObject({ status: 401 });
    expect(refresh).not.toHaveBeenCalled();
  });
});
