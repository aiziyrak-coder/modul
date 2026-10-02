import type { Attendance } from '../api/types';

export function lessonScoreAverage(
  rows: ReadonlyArray<Pick<Attendance, 'status' | 'score'>>,
): number | null {
  let sum = 0;
  let count = 0;
  for (const r of rows) {
    if (r.status !== 'present' || r.score == null) continue;
    sum += r.score;
    count += 1;
  }
  return count === 0 ? null : sum / count;
}

export const scoreAvgText = (avg: number | null): string =>
  avg === null || !Number.isFinite(avg) ? '—' : avg.toFixed(1);
