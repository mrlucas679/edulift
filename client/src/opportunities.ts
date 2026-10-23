import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { request } from './api';
import { source } from './reference';

const opportunity = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.string(),
  provider: z.string(),
  url: z.string(),
  closes_on: z.string().nullable(),
  source,
});
export type Opportunity = z.infer<typeof opportunity>;

export const matched = opportunity.extend({
  verdict: z.enum(['qualifies', 'may_qualify']),
  checks: z.array(z.object({ check: z.string(), status: z.enum(['met', 'not_met', 'unknown']) })),
});
export type Matched = z.infer<typeof matched>;

export const KIND_LABELS: Record<string, string> = {
  bursary: 'Bursaries',
  loan: 'Loans',
  learnership: 'Learnerships',
  work: 'Work',
};

const query = (kind: string | null) => (kind ? `?kind=${encodeURIComponent(kind)}` : '');

export const useOpportunities = (kind: string | null) =>
  useQuery({
    queryKey: ['opportunities', kind],
    queryFn: () => request(`/v1/opportunities${query(kind)}`, z.array(opportunity)),
  });

export const useMyOpportunities = (kind: string | null, accessToken: string | null) =>
  useQuery({
    queryKey: ['my-opportunities', kind, accessToken],
    queryFn: () => request(`/v1/me/opportunities${query(kind)}`, z.array(matched), { accessToken }),
    enabled: accessToken !== null,
  });
