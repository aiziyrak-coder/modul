export function takenCriteriaIds(rows: Array<{ criteriaId: string }>): Set<string> {
  return new Set(rows.map((r) => r.criteriaId).filter(Boolean));
}

export function availableCriteria<T extends { id: string }>(
  all: T[],
  taken: Set<string>,
  currentId: string,
): T[] {
  return all.filter((opt) => opt.id === currentId || !taken.has(opt.id));
}

export function findDuplicateCriteriaId(rows: Array<{ criteriaId: string }>): string | null {
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.criteriaId) continue;
    if (seen.has(row.criteriaId)) return row.criteriaId;
    seen.add(row.criteriaId);
  }
  return null;
}
