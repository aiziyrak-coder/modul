export const CAT_POINTS_MAX = 100;

export function catPointsError(raw: string): string | null {
  if (raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 'Faqat son kiriting';
  if (n < 1 || n > CAT_POINTS_MAX) return `Ball 1 va ${CAT_POINTS_MAX} orasida bo'lishi kerak`;
  return null;
}

export function catPointsValid(raw: string): boolean {
  return raw !== '' && catPointsError(raw) === null;
}
