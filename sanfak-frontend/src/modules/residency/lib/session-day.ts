import { uzToday } from './uz-day';

const ACADEMIC_YEAR_START_MONTH = 9;

export function academicYearLastDay(dayKey: string): string {
  const year = Number(dayKey.slice(0, 4));
  const month = Number(dayKey.slice(5, 7));
  const startYear = month >= ACADEMIC_YEAR_START_MONTH ? year : year - 1;
  return `${startYear + 1}-08-31`;
}

export interface DayRange {
  from: string;
  to: string;
}

export function announceableRange(now: Date = new Date()): DayRange {
  const from = uzToday(now);
  return { from, to: academicYearLastDay(from) };
}

export const isPastDay = (day: string, now: Date = new Date()): boolean =>
  day !== '' && day < uzToday(now);

export const isDayInRange = (day: string, range: DayRange): boolean =>
  day >= range.from && day <= range.to;

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const isDayKey = (v: unknown): v is string => typeof v === 'string' && DAY_KEY.test(v);

export function toDayRange(meta: Record<string, unknown>): DayRange | null {
  const { from, to } = meta;
  return isDayKey(from) && isDayKey(to) && from <= to ? { from, to } : null;
}
