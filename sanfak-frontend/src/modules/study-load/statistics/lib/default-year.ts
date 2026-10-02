import type { RefOption } from '../model/types';

export function currentAcademicYear(now: Date = new Date()): string {
  const startYear = now.getMonth() + 1 >= 9 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}/${startYear + 1}`;
}

export function resolveDefaultAcademicYearId(
  years: readonly RefOption[],
  now: Date = new Date(),
): string | undefined {
  if (years.length === 0) return undefined;
  const wanted = currentAcademicYear(now);
  const match = years.find((y) => y.title === wanted);
  return (match ?? years[years.length - 1])?.id;
}
