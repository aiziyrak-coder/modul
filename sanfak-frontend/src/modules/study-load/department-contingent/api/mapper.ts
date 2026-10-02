import type {
  ContingentGroup,
  ContingentStream,
  DeptContingentDetail,
  DeptContingentListItem,
  DeptContingentRow,
  PrefillSuggestion,
  RowDerived,
  RowDraft,
  RowInput,
  StreamDraft,
  SummaryView,
} from '../model/types';
import { cohortKey } from '../model/invariants';

interface BackendRef {
  _id: string;
  title?: string | null;
  code?: string | null;
}

type RefLike = BackendRef | string | null | undefined;

export interface BackendGroup {
  _id: string;
  title?: string | null;
  lang?: RefLike;
  studentNumber?: number | null;
  active?: boolean | null;
  missing?: boolean;
}

export interface BackendStream {
  number?: number | null;
  groups?: Array<BackendGroup | string> | null;
  languages?: Array<RefLike> | null;
}

export interface BackendDerived {
  groupCount?: number | null;
  studentCount?: number | null;
  streamCount?: number | null;
}

export interface BackendRow {
  _id?: string;
  direction?: RefLike;
  courseNum?: number | null;
  streams?: BackendStream[] | null;
  note?: string | null;
  derived?: BackendDerived | null;
  problems?: string[] | null;
}

export interface BackendDeptContingent {
  _id: string;
  department?: RefLike;
  academicYear?: RefLike;
  rowCount?: number | null;
  streamCount?: number | null;
  rows?: BackendRow[] | null;
  updatedAt?: string | null;
}

export interface BackendPrefill {
  direction?: RefLike;
  courseNum?: number | string | null;
  streams?: Array<{ number?: number | null; groups?: Array<string | BackendGroup> | null }> | null;
  groups?: BackendGroup[] | null;
}

export interface BackendSummary {
  departments?: Array<{
    department?: RefLike;
    updatedAt?: string | null;
    rows?: Array<{ direction?: RefLike; courseNum?: number | null; courseId?: RefLike } & BackendDerived> | null;
  }> | null;
  cohorts?: Array<{
    direction?: RefLike;
    directionTitle?: string | null;
    course?: RefLike;
    courseId?: RefLike;
    courseTitle?: string | null;
    groupCount?: number | null;
    studentCount?: number | null;
  }> | null;
  missingDepartments?: BackendRef[] | null;
  totals?: { withContingent?: number | null; expected?: number | null } | null;
}

export interface BackendSaveMeta {
  flaggedWorkloads?: number | null;
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function refId(r: RefLike): string | null {
  if (!r) return null;
  return typeof r === 'string' ? r : r._id;
}

const refTitle = (r: RefLike): string => (r && typeof r === 'object' ? (r.title ?? '') : '');
const refCode = (r: RefLike): string => (r && typeof r === 'object' ? (r.code ?? '') : '');

const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };

export function courseNumFromTitle(title: string | null | undefined): number {
  if (!title) return 0;
  const norm = String(title).trim().toUpperCase().replace(/[-_\s]?KURS$/, '').trim();
  if (norm in ROMAN) return ROMAN[norm] ?? 0;
  const n = parseInt(norm, 10);
  return Number.isFinite(n) ? n : 0;
}

export function mapGroup(b: BackendGroup | string): ContingentGroup {
  if (typeof b === 'string') {
    return { id: b, title: '', langId: null, langTitle: '', studentNumber: 0, inactive: false, missing: false };
  }
  return {
    id: b._id,
    title: b.title ?? '',
    langId: refId(b.lang),
    langTitle: refTitle(b.lang),
    studentNumber: num(b.studentNumber),
    inactive: b.active === false,
    missing: b.missing === true,
  };
}

export function languageTitlesOf(groups: Iterable<ContingentGroup>): Map<string, string> {
  const out = new Map<string, string>();
  for (const g of groups) {
    if (g.langId && g.langTitle && !out.has(g.langId)) out.set(g.langId, g.langTitle);
  }
  return out;
}

const mapDerived = (d: BackendDerived | null | undefined): RowDerived => ({
  groupCount: num(d?.groupCount),
  studentCount: num(d?.studentCount),
  streamCount: num(d?.streamCount),
});

function mapStream(s: BackendStream): ContingentStream {
  return {
    number: num(s.number),
    groups: (s.groups ?? []).map(mapGroup),
    languageIds: (s.languages ?? []).map(refId).filter((x): x is string => Boolean(x)),
  };
}

export function mapRow(b: BackendRow): DeptContingentRow {
  const directionId = refId(b.direction) ?? '';
  const courseNum = num(b.courseNum);
  return {
    key: b._id ?? `${directionId}|${courseNum}`,
    directionId,
    directionTitle: refTitle(b.direction),
    directionCode: refCode(b.direction),
    courseNum,
    streams: (b.streams ?? []).map(mapStream),
    note: b.note ?? null,
    derived: mapDerived(b.derived),
    problems: b.problems ?? [],
  };
}

export function mapListItem(b: BackendDeptContingent): DeptContingentListItem {
  return {
    id: b._id,
    departmentId: refId(b.department),
    departmentTitle: refTitle(b.department),
    academicYearId: refId(b.academicYear),
    academicYearTitle: refTitle(b.academicYear),
    rowCount: num(b.rowCount),
    streamCount: num(b.streamCount),
    updatedAt: b.updatedAt ?? null,
  };
}

export function mapDetail(b: BackendDeptContingent): DeptContingentDetail {
  return {
    id: b._id,
    departmentId: refId(b.department),
    departmentTitle: refTitle(b.department),
    academicYearId: refId(b.academicYear),
    academicYearTitle: refTitle(b.academicYear),
    updatedAt: b.updatedAt ?? null,
    rows: (b.rows ?? []).map(mapRow),
  };
}

export function mapPrefill(b: BackendPrefill): PrefillSuggestion {
  return {
    directionId: refId(b.direction) ?? '',
    courseNum: num(typeof b.courseNum === 'string' ? Number(b.courseNum) : b.courseNum),
    streams: (b.streams ?? []).map((s) => ({
      number: num(s.number),
      groupIds: (s.groups ?? []).map((g) => (typeof g === 'string' ? g : g._id)),
    })),
    groups: (b.groups ?? []).map(mapGroup),
  };
}

export const mapFlagged = (m: BackendSaveMeta | null | undefined): number => num(m?.flaggedWorkloads);

export function summaryJoinKey(directionId: string, courseId: string | null, courseNum: number): string {
  return courseId ? `${directionId}|c:${courseId}` : cohortKey(directionId, courseNum);
}

export function mapSummary(b: BackendSummary | null | undefined): SummaryView {
  return {
    departments: (b?.departments ?? []).map((d) => ({
      departmentId: refId(d.department) ?? '',
      departmentTitle: refTitle(d.department),
      updatedAt: d.updatedAt ?? null,
      rows: (d.rows ?? []).map((r) => {
        const directionId = refId(r.direction) ?? '';
        const courseNum = num(r.courseNum);
        const courseId = refId(r.courseId);
        return {
          directionId,
          directionTitle: refTitle(r.direction),
          courseNum,
          courseId,
          joinKey: summaryJoinKey(directionId, courseId, courseNum),
          ...mapDerived(r),
        };
      }),
    })),
    cohorts: (b?.cohorts ?? []).map((c) => {
      const directionId = refId(c.direction) ?? '';
      const courseId = refId(c.courseId);
      const courseNum = courseNumFromTitle(c.courseTitle);
      return {
        directionId,
        directionTitle: c.directionTitle ?? refTitle(c.direction),
        courseId: courseId ?? refId(c.course) ?? '',
        courseTitle: c.courseTitle ?? '',
        courseNum,
        joinKey: summaryJoinKey(directionId, courseId, courseNum),
        groupCount: num(c.groupCount),
        studentCount: num(c.studentCount),
      };
    }),
    missingDepartments: (b?.missingDepartments ?? []).map((d) => ({ id: d._id, title: d.title ?? '' })),
    totals: {
      withContingent: num(b?.totals?.withContingent),
      expected: num(b?.totals?.expected),
    },
  };
}

const streamInput = (streams: StreamDraft[]) =>
  streams.map((s) => ({ number: s.number, groups: [...s.groupIds] }));

export function draftToInput(d: RowDraft): RowInput {
  const note = d.note.trim();
  return {
    direction: d.directionId,
    courseNum: d.courseNum,
    streams: streamInput(d.streams),
    ...(note ? { note } : {}),
  };
}

export function rowToDraft(r: DeptContingentRow): RowDraft {
  return {
    directionId: r.directionId,
    courseNum: r.courseNum,
    streams: r.streams.map((s) => ({ number: s.number, groupIds: s.groups.map((g) => g.id) })),
    note: r.note ?? '',
  };
}

export const rowToInput = (r: DeptContingentRow): RowInput => draftToInput(rowToDraft(r));
