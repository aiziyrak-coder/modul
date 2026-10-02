import { MAX_STREAMS, type ContingentGroup, type RowDerived, type RowDraft, type StreamDraft } from './types';

export type RowErrorKey =
  | 'studyLoad.deptContingent.invariant.noDirection'
  | 'studyLoad.deptContingent.invariant.noStreams'
  | 'studyLoad.deptContingent.invariant.emptyStream'
  | 'studyLoad.deptContingent.invariant.streamNumber'
  | 'studyLoad.deptContingent.invariant.groupInTwoStreams'
  | 'studyLoad.deptContingent.invariant.duplicateRow';

export const cohortKey = (directionId: string, courseNum: number) => `${directionId}|${courseNum}`;

export function duplicateGroupIds(streams: StreamDraft[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const s of streams) {
    for (const id of s.groupIds) {
      if (seen.has(id)) dup.add(id);
      seen.add(id);
    }
  }
  return [...dup];
}

export const emptyStreamNumbers = (streams: StreamDraft[]): number[] =>
  streams.filter((s) => s.groupIds.length === 0).map((s) => s.number);

export function hasBadStreamNumbers(streams: StreamDraft[]): boolean {
  const seen = new Set<number>();
  for (const s of streams) {
    if (!Number.isInteger(s.number) || s.number < 1 || s.number > MAX_STREAMS) return true;
    if (seen.has(s.number)) return true;
    seen.add(s.number);
  }
  return false;
}

export function rowDraftErrors(draft: RowDraft, otherKeys: readonly string[]): RowErrorKey[] {
  const errors: RowErrorKey[] = [];
  if (!draft.directionId) errors.push('studyLoad.deptContingent.invariant.noDirection');
  if (draft.streams.length === 0) errors.push('studyLoad.deptContingent.invariant.noStreams');
  if (emptyStreamNumbers(draft.streams).length > 0) errors.push('studyLoad.deptContingent.invariant.emptyStream');
  if (hasBadStreamNumbers(draft.streams)) errors.push('studyLoad.deptContingent.invariant.streamNumber');
  if (duplicateGroupIds(draft.streams).length > 0) {
    errors.push('studyLoad.deptContingent.invariant.groupInTwoStreams');
  }
  if (draft.directionId && otherKeys.includes(cohortKey(draft.directionId, draft.courseNum))) {
    errors.push('studyLoad.deptContingent.invariant.duplicateRow');
  }
  return errors;
}

export function deriveCounts(streams: StreamDraft[], groupsById: ReadonlyMap<string, ContingentGroup>): RowDerived {
  const ids = new Set(streams.flatMap((s) => s.groupIds));
  let studentCount = 0;
  for (const id of ids) studentCount += groupsById.get(id)?.studentNumber ?? 0;
  return {
    groupCount: ids.size,
    studentCount,
    streamCount: streams.filter((s) => s.groupIds.length > 0).length,
  };
}

export function streamLanguageIds(stream: StreamDraft, groupsById: ReadonlyMap<string, ContingentGroup>): string[] {
  const langs = new Set<string>();
  for (const id of stream.groupIds) {
    const lang = groupsById.get(id)?.langId;
    if (lang) langs.add(lang);
  }
  return [...langs];
}

export function unassignedGroups(pool: ContingentGroup[], streams: StreamDraft[]): ContingentGroup[] {
  const used = new Set(streams.flatMap((s) => s.groupIds));
  return pool.filter((g) => !g.inactive && !g.missing && !used.has(g.id));
}

export const nextStreamNumber = (streams: StreamDraft[]): number =>
  streams.reduce((m, s) => Math.max(m, s.number), 0) + 1;
