import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { request } from './api';
import { useSession } from './session';

const me = z.object({
  id: z.string(),
  status: z.enum(['onboarding', 'pending_guardian', 'active', 'restricted']),
  first_name: z.string().nullable(),
  birth_date: z.string().nullable(),
  province: z.string().nullable(),
  certificate: z.string().nullable(),
  consents: z.array(z.string()),
  reconfirm: z.array(z.string()),
  interests: z.array(z.string()),
});
export type MeDetail = z.infer<typeof me>;

const guardianView = z.object({
  learner_first_name: z.string(),
  guardian_name: z.string(),
  optional_purposes: z.array(z.string()),
});

export const PURPOSES: Record<string, string> = {
  account: 'Keep my marks, saved items and applications so EduLift can match me. I can download or delete them any time.',
  ai_explanations: 'Explain my results in plain language. The result (not my name or contact details) goes to an AI service that may be outside South Africa.',
  ai_writing: 'Answer my questions and help draft a CV or letter. What I type goes to an AI service that may be outside South Africa.',
  reminders: 'Email me before deadlines I saved. Nothing else.',
  nbt_results: 'Use my NBT levels to check admission rules that need them. Optional: without them, those rules show as unconfirmed. Removing them deletes them.',
  low_data: 'Use less data: no course badges, shorter lists. Turn it off any time.',
};

// Same choices, worded for the parent reading them.
export const GUARDIAN_PURPOSES: Record<string, string> = {
  ai_explanations: 'Explain their results in plain language. The result (not their name or contact details) goes to an AI service that may be outside South Africa.',
  ai_writing: 'Answer their questions and help draft a CV or letter. What they type goes to an AI service that may be outside South Africa.',
  reminders: 'Email them before deadlines they saved. Nothing else.',
  nbt_results: 'Use their NBT levels to check admission rules that need them. Optional: without them, those rules show as unconfirmed. Removing them deletes them.',
};

export function useMe() {
  const { status, accessToken } = useSession();
  return useQuery({
    queryKey: ['me-details', accessToken],
    queryFn: () => request('/v1/me/details', me, { accessToken }),
    enabled: status === 'signed-in',
  });
}

export const saveProfile = (
  accessToken: string | null,
  body: {
    first_name?: string;
    birth_date: string;
    province?: string | null;
    certificate?: 'nsc' | 'ieb' | 'sacai' | null;
    interests?: string[];
  },
) =>
  request('/v1/me/profile', me, { method: 'PUT', body, accessToken });

export const setConsent = (
  accessToken: string | null,
  purpose: string,
  granted: boolean,
  contactEmail?: string,
) =>
  request('/v1/me/consents', me, {
    method: 'POST',
    body: { purpose, granted, ...(contactEmail ? { contact_email: contactEmail } : {}) },
    accessToken,
  });

export const askGuardian = (accessToken: string | null, body: { guardian_name: string; guardian_email: string }) =>
  request('/v1/me/guardian', z.undefined(), { method: 'POST', body, accessToken });

export const viewGuardianRequest = (token: string) =>
  request(`/v1/guardian/${encodeURIComponent(token)}`, guardianView);

export const decideGuardianRequest = (token: string, body: object) =>
  request(`/v1/guardian/${encodeURIComponent(token)}`, z.undefined(), { method: 'POST', body });

export const saveMarks = (accessToken: string | null, period: string, marks: Record<string, number>) =>
  request(`/v1/me/marks/${period}`, z.record(z.string(), z.number()), {
    method: 'PUT',
    body: { marks },
    accessToken,
  });

const decided = z.object({ withdraw_token: z.string() });

// Approve returns the withdraw token, which the approved page needs.
export const approveGuardianRequest = (token: string, body: object) =>
  request(`/v1/guardian/${encodeURIComponent(token)}`, decided, { method: 'POST', body });

export const guardianExport = (withdrawToken: string) =>
  request(`/v1/guardian/withdraw/${encodeURIComponent(withdrawToken)}/export`, z.record(z.string(), z.unknown()));

export const withdrawGuardianApproval = (withdrawToken: string) =>
  request(`/v1/guardian/withdraw/${encodeURIComponent(withdrawToken)}`, z.undefined(), { method: 'POST' });
