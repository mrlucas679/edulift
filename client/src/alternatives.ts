import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';

import { request } from './api';
import { matched } from './opportunities';

const programme = z.object({
  id: z.string(),
  name: z.string(),
  institution_id: z.string(),
  qualification: z.string(),
  field_id: z.string(),
  min_aps: z.number().nullable(),
  selection: z.boolean(),
  // "closed": you'd get in, but this intake's applications have closed.
  window: z.string().optional(),
});

const alternatives = z.object({
  routes: z.array(
    z.object({
      key: z.string(),
      title: z.string(),
      items: z.array(programme),
      empty_reason: z.string(),
    }),
  ),
  funding: z.array(matched),
  work: z.array(matched),
});
export type Alternatives = z.infer<typeof alternatives>;

export function useAlternatives(programmeId: string, accessToken: string | null) {
  return useMutation({
    mutationFn: () =>
      request(`/v1/programmes/${encodeURIComponent(programmeId)}/alternatives`, alternatives, {
        method: 'POST',
        body: {},
        accessToken,
      }),
  });
}
