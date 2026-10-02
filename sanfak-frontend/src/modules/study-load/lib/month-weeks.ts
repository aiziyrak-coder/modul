export interface MonthCount {
  month: string;
  count: number;
}

export interface MonthLike {
  month?: string | null;
  weeks?: unknown[] | null;
}

export function monthCountsOf(months: MonthLike[] | null | undefined): MonthCount[] {
  return (months ?? []).map((m) => ({
    month: m.month ?? '',
    count: Array.isArray(m.weeks) ? m.weeks.length : 0,
  }));
}

export function totalOf(counts: MonthCount[]): number {
  return counts.reduce((sum, c) => sum + (Number.isFinite(c.count) ? c.count : 0), 0);
}

export function equalMonthCounts(monthNames: string[], total: number): MonthCount[] {
  const n = monthNames.length || 1;
  const base = Math.floor(total / n);
  const extra = total % n;
  return monthNames.map((month, i) => ({ month, count: base + (i < extra ? 1 : 0) }));
}

export type MonthCountsError = 'empty' | 'notInteger' | 'belowOne' | 'total';

export function validateMonthCounts(
  counts: MonthCount[],
  expectedTotal: number,
): MonthCountsError | null {
  if (!counts.length) return 'empty';
  for (const c of counts) {
    if (!Number.isInteger(c.count)) return 'notInteger';
    if (c.count < 1) return 'belowOne';
  }
  return totalOf(counts) === expectedTotal ? null : 'total';
}
