import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { request } from './api';
import { useSession } from './session';

export const NBT_COMPONENTS = [
  { id: 'AL', label: 'Academic Literacy' },
  { id: 'QL', label: 'Quantitative Literacy' },
  { id: 'MAT', label: 'Mathematics' },
] as const;

export const NBT_LEVELS = [
  { id: 'basic', label: 'Basic' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'upper_intermediate', label: 'Upper Intermediate' },
  { id: 'proficient', label: 'Proficient' },
] as const;

export type NbtComponent = (typeof NBT_COMPONENTS)[number]['id'];
export type NbtLevel = (typeof NBT_LEVELS)[number]['id'];

const nbtLevels = z.record(z.string(), z.string());

export function useNbt() {
  const { status, accessToken } = useSession();
  return useQuery({
    queryKey: ['nbt', accessToken],
    queryFn: () => request('/v1/me/nbt', nbtLevels, { accessToken }),
    enabled: status === 'signed-in',
  });
}

export const saveNbtLevel = (accessToken: string | null, component: NbtComponent, level: NbtLevel) =>
  request(`/v1/me/nbt/${component}`, nbtLevels, { accessToken, method: 'PUT', body: { level } });

export const removeNbtLevel = (accessToken: string | null, component: NbtComponent) =>
  request(`/v1/me/nbt/${component}`, z.unknown(), { accessToken, method: 'DELETE' });
