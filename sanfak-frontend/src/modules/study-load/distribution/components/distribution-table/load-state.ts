import type { DistributionTeacher } from '../../model/types';

export type LoadState = 'ok' | 'under' | 'over';

export function loadState(t: DistributionTeacher): LoadState {
  if (t.isVacant || t.minHour === null) return 'ok';
  if (t.auditoriumHour === null) return 'ok';
  if (t.auditoriumHour < t.minHour) return 'under';
  if (t.maxHour !== null && t.auditoriumHour > t.maxHour) return 'over';
  return 'ok';
}
