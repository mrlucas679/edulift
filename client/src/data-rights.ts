import { z } from 'zod';

import { request } from './api';

export const exportData = (accessToken: string | null) =>
  request('/v1/me/export', z.record(z.string(), z.unknown()), { accessToken });

export const deleteAccount = (accessToken: string | null) =>
  request('/v1/me', z.undefined(), { method: 'DELETE', accessToken });
