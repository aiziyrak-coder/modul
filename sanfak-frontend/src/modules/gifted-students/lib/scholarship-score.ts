import type { Scholarship, ScholarshipApplication } from '../data/types';

export const REVIEW_PASSED = 'recommended';

export function scholarshipColumnKeys(sch: Scholarship | undefined): string[] {
  return (sch?.criteria ?? []).flatMap((c) =>
    c.categoryIds?.length
      ? c.categoryIds.map((cid) => `${c.criteriaId}_${cid}`)
      : [c.criteriaId],
  );
}

export function judgeTotal(
  scores: Record<string, number> | undefined,
  columnKeys: readonly string[],
): number | null {
  if (!scores) return null;
  return columnKeys.reduce((sum, key) => sum + (scores[key] || 0), 0);
}

export function averageJudgeTotal(
  app: ScholarshipApplication,
  judgeIds: readonly string[],
  columnKeys: readonly string[],
): number | null {
  const totals = judgeIds
    .map((id) => judgeTotal(app.judgeScores?.[id], columnKeys))
    .filter((t): t is number => t !== null);
  if (!totals.length) return null;
  return totals.reduce((sum, t) => sum + t, 0) / totals.length;
}

export function isScholarshipWinner(
  app: ScholarshipApplication,
  sch: Scholarship | undefined,
): boolean {
  if (app.status !== REVIEW_PASSED) return false;
  if (sch?.type !== 'rektor') return true;
  const avg = averageJudgeTotal(app, sch.judges ?? [], scholarshipColumnKeys(sch));
  return avg !== null && avg >= sch.minScore;
}
