import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { request } from './api';
import { useSession } from './session';

export const PERIODS = [
  { id: 'gr11_final', label: 'Gr 11 final' },
  { id: 'gr12_june', label: 'Gr 12 June' },
  { id: 'gr12_prelim', label: 'Prelims' },
  { id: 'gr12_final', label: 'Final NSC' },
] as const;

export const savedMarks = z.record(z.string(), z.record(z.string(), z.number()));
export type SavedMarks = z.infer<typeof savedMarks>;

export function useSavedMarks() {
  const { status, accessToken } = useSession();
  return useQuery({
    queryKey: ['saved-marks', accessToken],
    queryFn: () => request('/v1/me/marks', savedMarks, { accessToken }),
    enabled: status === 'signed-in',
  });
}

export function latestMarks(data: SavedMarks | undefined): Record<string, number> | null {
  if (!data) return null;
  const newest = ['gr12_final', 'gr12_prelim', 'gr12_june', 'gr11_final'].find((p) => data[p]);
  return newest ? (data[newest] ?? null) : null;
}
