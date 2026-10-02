export const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function toClockMinutes(hhmm: string | null | undefined): number | null {
  const m = TIME_RE.exec(String(hhmm ?? ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export type ClockPairIssue = 'half' | 'format' | 'order' | null;

export function checkClockPair(inRaw: string, outRaw: string): ClockPairIssue {
  const a = inRaw.trim();
  const b = outRaw.trim();
  if (a === '' && b === '') return null;
  if (a === '' || b === '') return 'half';

  const inMin = toClockMinutes(a);
  const outMin = toClockMinutes(b);
  if (inMin === null || outMin === null) return 'format';
  if (inMin >= outMin) return 'order';
  return null;
}

export function isWithinWindow(
  inRaw: string | null | undefined,
  outRaw: string | null | undefined,
  from: string,
  to: string,
): boolean {
  const inMin = toClockMinutes(inRaw);
  const outMin = toClockMinutes(outRaw);
  if (inMin === null || outMin === null) return true;

  const fromMin = toClockMinutes(from);
  const toMin = toClockMinutes(to);
  if (fromMin === null || toMin === null) return true;

  return inMin >= fromMin && outMin <= toMin;
}
