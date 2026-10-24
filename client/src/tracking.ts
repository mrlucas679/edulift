import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { request } from './api';

export const STATUSES = ['planning', 'submitted', 'offer', 'waitlist', 'declined', 'withdrawn'] as const;
export type Status = (typeof STATUSES)[number];

const checklistItem = z.object({ id: z.number(), label: z.string(), done: z.boolean() });

export const application = z.object({
  id: z.number(),
  target_kind: z.string(),
  target_id: z.string(),
  name: z.string(),
  status: z.enum(STATUSES),
  external_reference: z.string().nullable(),
  submitted_on: z.string().nullable(),
  offer_deadline: z.string().nullable(),
  notes: z.string(),
  apply_url: z.string(),
  needs_reference: z.boolean(),
  deadline_soon: z.boolean(),
  checklist: z.array(checklistItem),
});
export type Application = z.infer<typeof application>;

export const saved = z.object({
  target_kind: z.string(),
  target_id: z.string(),
  name: z.string(),
  closes_on: z.string().nullable(),
});
export type Saved = z.infer<typeof saved>;

const KEY = ['applications'] as const;

export function useApplications(accessToken: string | null) {
  return useQuery({
    queryKey: [...KEY, accessToken],
    queryFn: () => request('/v1/me/applications', z.array(application), { accessToken }),
    enabled: accessToken !== null,
  });
}

export function useApplication(id: number, accessToken: string | null) {
  return useQuery({
    queryKey: [...KEY, id, accessToken],
    queryFn: () => request(`/v1/me/applications/${id}`, application, { accessToken }),
    enabled: accessToken !== null,
  });
}

export function useStartApplication(accessToken: string | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (target: { target_kind: 'programme' | 'opportunity'; target_id: string }) =>
      request('/v1/me/applications', application, { method: 'POST', body: target, accessToken }),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateApplication(id: number, accessToken: string | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Pick<Application, 'status' | 'external_reference' | 'offer_deadline' | 'notes'>>) =>
      request(`/v1/me/applications/${id}`, application, { method: 'PATCH', body: patch, accessToken }),
    onSuccess: (data) => client.setQueryData([...KEY, id, accessToken], data),
  });
}

export function useTickItem(applicationId: number, accessToken: string | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, done }: { itemId: number; done: boolean }) =>
      request(`/v1/me/applications/${applicationId}/checklist/${itemId}?done=${done}`, application, {
        method: 'PATCH',
        accessToken,
      }),
    onSuccess: (data) => client.setQueryData([...KEY, applicationId, accessToken], data),
  });
}

export function useSaved(accessToken: string | null) {
  return useQuery({
    queryKey: ['saved', accessToken],
    queryFn: () => request('/v1/me/saved', z.array(saved), { accessToken }),
    enabled: accessToken !== null,
  });
}

export function useToggleSaved(accessToken: string | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ kind, id, on }: { kind: 'programme' | 'opportunity'; id: string; on: boolean }) => {
      if (on) {
        return request('/v1/me/saved', saved, {
          method: 'POST',
          body: { target_kind: kind, target_id: id },
          accessToken,
        });
      }
      await request(`/v1/me/saved/${kind}/${encodeURIComponent(id)}`, z.undefined(), {
        method: 'DELETE',
        accessToken,
      });
      return null;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['saved'] }),
  });
}
