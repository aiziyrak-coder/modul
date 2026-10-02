export const ALL_YEARS = 'all';

export interface YearScoreSource {
  totalScore?: number;
  scoresByYear?: Record<string, number>;
}

export function rankingScore(s: YearScoreSource, filterYear: string): number {
  if (filterYear === ALL_YEARS) return s.totalScore ?? 0;
  return s.scoresByYear?.[filterYear] ?? 0;
}
