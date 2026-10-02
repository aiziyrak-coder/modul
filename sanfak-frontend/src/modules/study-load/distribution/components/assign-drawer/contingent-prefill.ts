import type {
  ContingentStream,
  DeptContingentListItem,
  DeptContingentRow,
} from '../../../department-contingent/model/types';
import type { StreamInput, WorkloadBlockOption } from '../../model/types';

export interface CountMismatch {
  field: 'stream' | 'group';
  contingent: number;
  workload: number;
}

export type ContingentPrefill =
  | { kind: 'noRow' }
  | {
      kind: 'found';
      streams: StreamInput[];
      groups: string[];
      droppedGroups: number;
      mismatches: CountMismatch[];
    };

type BlockKey = Pick<WorkloadBlockOption, 'directionId' | 'course' | 'streamCount' | 'groupCount'>;

export function pickContingentId(
  items: DeptContingentListItem[],
  departmentId: string | null,
  academicYearId: string | null,
): string | null {
  const sameYear = academicYearId
    ? items.filter((i) => i.academicYearId === academicYearId)
    : items;
  if (departmentId) return sameYear.find((i) => i.departmentId === departmentId)?.id ?? null;
  return sameYear.length === 1 ? (sameYear[0]?.id ?? null) : null;
}

export function findContingentRow(
  rows: DeptContingentRow[],
  block: Pick<BlockKey, 'directionId' | 'course'>,
): DeptContingentRow | null {
  if (!block.directionId || !(block.course > 0)) return null;
  return rows.find((r) => r.directionId === block.directionId && r.courseNum === block.course) ?? null;
}

export function streamLanguage(stream: ContingentStream): string | null {
  const ids = new Set(
    stream.languageIds.length > 0
      ? stream.languageIds
      : stream.groups.map((g) => g.langId).filter((x): x is string => Boolean(x)),
  );
  return ids.size === 1 ? ([...ids][0] ?? null) : null;
}

export function unionGroupIds(streams: StreamInput[]): string[] {
  return [...new Set(streams.flatMap((s) => s.groups))];
}

export function detectCountMismatch(
  derived: DeptContingentRow['derived'],
  block: Pick<BlockKey, 'streamCount' | 'groupCount'>,
): CountMismatch[] {
  const out: CountMismatch[] = [];
  if (block.streamCount !== null && block.streamCount !== derived.streamCount) {
    out.push({ field: 'stream', contingent: derived.streamCount, workload: block.streamCount });
  }
  if (block.groupCount !== null && block.groupCount !== derived.groupCount) {
    out.push({ field: 'group', contingent: derived.groupCount, workload: block.groupCount });
  }
  return out;
}

export function buildContingentPrefill(
  rows: DeptContingentRow[],
  block: BlockKey,
  availableGroupIds: ReadonlySet<string> | null,
): ContingentPrefill {
  const row = findContingentRow(rows, block);
  if (!row) return { kind: 'noRow' };

  let droppedGroups = 0;
  const streams: StreamInput[] = [];
  for (const s of row.streams) {
    const groups = s.groups
      .filter((g) => {
        const ok = !g.missing && (availableGroupIds === null || availableGroupIds.has(g.id));
        if (!ok) droppedGroups += 1;
        return ok;
      })
      .map((g) => g.id);
    if (groups.length > 0) streams.push({ number: s.number, groups, language: streamLanguage(s) });
  }

  return {
    kind: 'found',
    streams,
    groups: unionGroupIds(streams),
    droppedGroups,
    mismatches: detectCountMismatch(row.derived, block),
  };
}
