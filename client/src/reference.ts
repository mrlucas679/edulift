import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { request } from './api';

export const source = z.object({
  title: z.string(),
  url: z.string(),
  publisher: z.string(),
  checked_on: z.string().nullable(),
});
export type Source = z.infer<typeof source>;

const institution = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  province: z.string(),
  apply_url: z.string(),
  route: z.enum(['direct', 'cao', 'cas']),
});
export type Institution = z.infer<typeof institution>;

const institutionDetail = institution.extend({
  fee_cents: z.number().nullable(),
  max_choices: z.number().nullable(),
  aps_scheme: z.string().nullable(),
  source,
  cycles: z.array(
    z.object({
      intake_year: z.number(),
      opens_on: z.string(),
      closes_on: z.string(),
      source,
    }),
  ),
});

const programme = z.object({
  id: z.string(),
  name: z.string(),
  institution_id: z.string(),
  qualification: z.string(),
  field_id: z.string(),
  min_aps: z.number().nullable(),
  selection: z.boolean(),
});
export type Programme = z.infer<typeof programme>;

const programmeDetail = programme.extend({
  closes_on: z.string().nullable(),
  verified: z.boolean(),
  source,
  requirement_groups: z.array(z.array(z.object({ subject_id: z.string(), min_percent: z.number() }))),
});

const programmePage = z.object({
  items: z.array(programme),
  page: z.number(),
  page_size: z.number(),
  total: z.number(),
});

const deadline = z.object({
  institution_id: z.string(),
  institution: z.string(),
  intake_year: z.number(),
  closes_on: z.string(),
  days_left: z.number(),
});
export type Deadline = z.infer<typeof deadline>;

const subject = z.object({ id: z.string(), name: z.string() });

export const useInstitutions = () =>
  useQuery({
    queryKey: ['institutions'],
    queryFn: () => request('/v1/institutions', z.array(institution)),
  });

export const useInstitution = (id: string) =>
  useQuery({
    queryKey: ['institution', id],
    queryFn: () => request(`/v1/institutions/${encodeURIComponent(id)}`, institutionDetail),
  });

export const useProgrammes = (params: { q?: string; institution?: string; field?: string; qualification?: string }) => {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.institution) query.set('institution', params.institution);
  if (params.field) query.set('field', params.field);
  if (params.qualification) query.set('qualification', params.qualification);
  return useQuery({
    queryKey: ['programmes', params],
    queryFn: () => request(`/v1/programmes?${query}`, programmePage),
  });
};

export const useProgramme = (id: string) =>
  useQuery({
    queryKey: ['programme', id],
    queryFn: () => request(`/v1/programmes/${encodeURIComponent(id)}`, programmeDetail),
  });

export const useDeadlines = () =>
  useQuery({ queryKey: ['deadlines'], queryFn: () => request('/v1/deadlines', z.array(deadline)) });

export const useSubjectNames = () =>
  useQuery({
    queryKey: ['subjects'],
    queryFn: () => request('/v1/subjects', z.array(subject)),
    select: (rows) => new Map(rows.map((s) => [s.id, s.name])),
    staleTime: Infinity,
  });

const previewRow = z.object({
  institution_id: z.string(),
  institution: z.string(),
  scheme: z.string().nullable(),
  score: z.number().nullable(),
});
export type PreviewRow = z.infer<typeof previewRow>;

export const useSubjects = () =>
  useQuery({
    queryKey: ['subjects'],
    queryFn: () => request('/v1/subjects', z.array(subject)),
    staleTime: Infinity,
  });

export const previewAps = (marks: Record<string, number>) =>
  request('/v1/aps/preview', z.array(previewRow), { method: 'POST', body: { marks } });

const verdict = z.object({
  programme_id: z.string(),
  outcome: z.string(),
  score: z.number().nullable(),
  scheme: z.string().nullable(),
  window: z.string(),
  checks: z.array(
    z.object({
      name: z.string(),
      required: z.string(),
      yours: z.string(),
      result: z.enum(['pass', 'fail', 'unknown']),
      source_url: z.string(),
      checked_on: z.string().nullable(),
    }),
  ),
  note: z.string(),
});
export type Verdict = z.infer<typeof verdict>;

export const checkProgramme = (id: string, marks: Record<string, number>, accessToken: string | null) =>
  request(`/v1/programmes/${encodeURIComponent(id)}/check`, verdict, {
    method: 'POST',
    body: { marks },
    accessToken,
  });

const handoff = z.object({ id: z.string(), name: z.string(), purpose: z.string(), url: z.string() });

export const useHandoffs = () =>
  useQuery({
    queryKey: ['handoffs'],
    queryFn: () => request('/v1/handoffs', z.array(handoff)),
    staleTime: Infinity,
  });

const field = z.object({ id: z.string(), name: z.string(), parent_id: z.string().nullable() });

export const useFields = () =>
  useQuery({
    queryKey: ['fields'],
    queryFn: () => request('/v1/fields', z.array(field)),
    staleTime: Infinity,
  });

const batchRow = z.object({ programme_id: z.string(), outcome: z.string() });

// One outcome per programme for the signed-in learner's saved marks.
export function useBatchChecks(accessToken: string | null) {
  return useQuery({
    queryKey: ['batch-checks', accessToken],
    queryFn: () => request('/v1/programmes/me/outcomes', z.array(batchRow), { method: 'POST', body: {}, accessToken }),
    enabled: accessToken !== null,
    retry: false,
  });
}
