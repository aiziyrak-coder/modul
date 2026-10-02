import type { TeachingScience } from '../model/types';

export function otherHoursOf(r: TeachingScience): number {
  if (!r.decomposed) return r.hoursByType.independent;
  return (r.hoursByType.otherWork ?? 0) + (r.hoursByType.adjustment ?? 0);
}

export function cellOf(v: number | null): number | string {
  return v === null || v === 0 ? '—' : v;
}
