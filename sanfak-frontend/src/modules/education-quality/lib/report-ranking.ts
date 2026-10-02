export interface RankableUnit {
  teacherCount: number;
  totalScore: number;
  avgScore: number;
  redCount: number;
  redShare: number;
}

export function compareUnits(a: RankableUnit, b: RankableUnit): number {
  if (a.teacherCount === 0 || b.teacherCount === 0) {
    if (a.teacherCount === b.teacherCount) return 0;
    return a.teacherCount === 0 ? 1 : -1;
  }
  if (a.redShare !== b.redShare) return a.redShare - b.redShare;
  if (a.avgScore !== b.avgScore) return b.avgScore - a.avgScore;
  return b.teacherCount - a.teacherCount;
}
