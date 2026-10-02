export const UZ_OFFSET_MINUTES = 5 * 60;
const UZ_OFFSET_MS = UZ_OFFSET_MINUTES * 60_000;

type DateInput = string | number | Date | null | undefined;

function uzIso(v: DateInput): string | null {
  if (v === null || v === undefined || v === '') return null;
  const t = v instanceof Date ? v.getTime() : new Date(v).getTime();
  const shifted = new Date(t + UZ_OFFSET_MS);
  return Number.isNaN(shifted.getTime()) ? null : shifted.toISOString();
}

export function uzDayKey(v: DateInput): string | null {
  return uzIso(v)?.slice(0, 10) ?? null;
}

export function uzToday(now: Date = new Date()): string {
  return uzDayKey(now) ?? now.toISOString().slice(0, 10);
}

export function formatDayKey(day: string | null | undefined): string {
  if (!day) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : day;
}

export function formatUzDay(v: DateInput): string {
  return formatDayKey(uzDayKey(v));
}

export function formatUzDateTime(v: DateInput): string {
  const iso = uzIso(v);
  return iso ? `${formatDayKey(iso.slice(0, 10))} ${iso.slice(11, 16)}` : '—';
}

export function formatUzClock(v: DateInput): string {
  return uzIso(v)?.slice(11, 16) ?? '—';
}
