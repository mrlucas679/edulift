import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { request } from './api';

const answer = z.object({
  answer: z.string(),
  cited: z.array(z.object({ id: z.string(), title: z.string(), url: z.string().nullable() })),
  provider: z.string(),
  fallback_reason: z.string().nullable(),
});
export type Answer = z.infer<typeof answer>;

const draft = z.object({
  text: z.string(),
  label: z.string(),
  provider: z.string(),
  fallback_reason: z.string().nullable(),
});
export type Draft = z.infer<typeof draft>;

const saved = z.object({
  id: z.number(),
  kind: z.string(),
  title: z.string(),
  content: z.string(),
});
export type SavedDraft = z.infer<typeof saved>;

export function useAsk(accessToken: string | null) {
  return useMutation({
    mutationFn: (question: string) =>
      request('/v1/ask', answer, { method: 'POST', body: { question }, accessToken }),
  });
}

export function useGenerateDraft(accessToken: string | null) {
  return useMutation({
    mutationFn: (input: { kind: 'cv' | 'motivation_letter'; facts: string }) =>
      request('/v1/me/drafts/generate', draft, { method: 'POST', body: input, accessToken }),
  });
}

export function useSaveDraft(accessToken: string | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { kind: 'cv' | 'motivation_letter'; title: string; content: string }) =>
      request('/v1/me/drafts', saved, { method: 'POST', body: input, accessToken }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['drafts'] }),
  });
}

export function useDrafts(accessToken: string | null) {
  return useQuery({
    queryKey: ['drafts', accessToken],
    queryFn: () => request('/v1/me/drafts', z.array(saved), { accessToken }),
    enabled: accessToken !== null,
  });
}
