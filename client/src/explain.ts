import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';

import { request } from './api';

const explanation = z.object({
  summary: z.string(),
  next_step: z.string(),
  plan_b_hint: z.string(),
  provider: z.enum(['template', 'bedrock']),
  fallback_reason: z.string().nullable(),
  disclaimer: z.string(),
});
export type Explanation = z.infer<typeof explanation>;

export function useExplain(programmeId: string, accessToken: string | null) {
  return useMutation({
    mutationFn: (marks: Record<string, number>) =>
      request(`/v1/programmes/${encodeURIComponent(programmeId)}/explain`, explanation, {
        method: 'POST',
        body: { marks },
        accessToken,
      }),
  });
}
