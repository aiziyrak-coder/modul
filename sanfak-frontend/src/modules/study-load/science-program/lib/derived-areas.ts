import type { DirectionRef } from '../../study-plan/model/types';

export type AreaField = 'knowledgeArea' | 'educationArea';

const APOSTROPHES = /[‘’ʻʼ`]/g;
const dedupeKey = (s: string): string => s.replace(APOSTROPHES, "'").toLowerCase();

export function hasOwnAreas(rows: readonly string[] | undefined): boolean {
  return (rows ?? []).some((r) => r.trim().length > 0);
}

export function derivedAreas(
  selectedIds: readonly string[] | undefined,
  directions: readonly DirectionRef[] | undefined,
  field: AreaField,
): string[] {
  const byId = new Map((directions ?? []).map((d) => [d.id, d]));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of selectedIds ?? []) {
    const value = byId.get(id)?.[field]?.trim() ?? '';
    if (!value || seen.has(dedupeKey(value))) continue;
    seen.add(dedupeKey(value));
    out.push(value);
  }
  return out;
}

export function derivedAreaHint(
  ownRows: readonly string[] | undefined,
  selectedIds: readonly string[] | undefined,
  directions: readonly DirectionRef[] | undefined,
  field: AreaField,
): string | null {
  if (hasOwnAreas(ownRows)) return null;
  const values = derivedAreas(selectedIds, directions, field);
  return values.length > 0 ? values.join(', ') : null;
}
