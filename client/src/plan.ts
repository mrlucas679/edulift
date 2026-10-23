import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { request } from './api';

const verdict = z.object({
  programme_id: z.string(),
  outcome: z.string(),
  score: z.number().nullable(),
  window: z.string(),
  note: z.string(),
});

const planTarget = z.object({
  programme_id: z.string(),
  name: z.string(),
  institution: z.string(),
  verdict: verdict.nullable(),
});

const plan = z.object({
  targets: z.array(planTarget),
  limit: z.number(),
});
export type Plan = z.infer<typeof plan>;

export const PLAN_KEY = ['plan'] as const;

export function usePlan(accessToken: string | null) {
  return useQuery({
    queryKey: [...PLAN_KEY, accessToken],
    queryFn: () => request('/v1/me/plan', plan, { accessToken }),
    enabled: accessToken !== null,
  });
}

// Replaces the whole plan, so removing a target is the same call as adding one.
export function useSavePlan(accessToken: string | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (programmeIds: string[]) =>
      request('/v1/me/plan', plan, {
        method: 'PUT',
        body: { programme_ids: programmeIds },
        accessToken,
      }),
    onSuccess: (data) => client.setQueryData([...PLAN_KEY, accessToken], data),
  });
}
