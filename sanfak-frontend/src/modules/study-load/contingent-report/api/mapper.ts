import { mapApprovalStep, type BackendApprovalStep } from '../../distribution/api/mapper';
import {
  CONTINGENT_CATEGORIES,
  CONTINGENT_NUM_FIELDS,
  PREFILL_FIELDS,
  type CellSource,
  type ContingentCategory,
  type ContingentNumbers,
  type ContingentReport,
  type ContingentReportDetail,
  type ContingentRow,
  type ContingentRowInput,
  type ForeignRow,
  type PrefillField,
  type PrefillMeta,
  type SummaryView,
} from '../model/types';

interface BackendRef {
  _id: string;
  title?: string | null;
  name?: string | null;
}

export type BackendNumbers = Partial<Record<(typeof CONTINGENT_NUM_FIELDS)[number], number | null>>;

export interface BackendContingentRow extends BackendNumbers {
  direction?: BackendRef | string | null;
  directionCode?: string | null;
  directionTitle?: string | null;
  category?: string | null;
  course?: number | null;
  source?: Partial<Record<PrefillField, string | null>> | null;
}

export interface BackendForeignRow {
  country?: string | null;
  total?: number | null;
  boys?: number | null;
  girls?: number | null;
}

export interface BackendContingentReport {
  _id: string;
  faculty?: BackendRef | string | null;
  facultyTitle?: string | null;
  academicYear?: BackendRef | string | null;
  academicYearTitle?: string | null;
  status?: string;
  asOfDate?: string | null;
  rows?: BackendContingentRow[];
  foreignByCountry?: BackendForeignRow[];
  approvalSteps?: BackendApprovalStep[];
  currentStep?: string | null;
  submittedAt?: string | null;
  lastPrefilledAt?: string | null;
  createdAt?: string | null;
}

export interface BackendPrefillMeta {
  directionCount?: number;
  groupsCounted?: number;
  groupsWithoutYear?: number;
  unresolvedCourse?: number;
  updated?: number;
  added?: number;
  skippedManual?: number;
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function refId(r: BackendRef | string | null | undefined): string | null {
  if (!r) return null;
  return typeof r === 'string' ? r : r._id;
}

function refTitle(r: BackendRef | string | null | undefined, fallback: string | null | undefined): string {
  if (r && typeof r === 'object') return r.title ?? r.name ?? fallback ?? '';
  return fallback ?? '';
}

export function mapNumbers(b: BackendNumbers): ContingentNumbers {
  return Object.fromEntries(CONTINGENT_NUM_FIELDS.map((f) => [f, num(b[f])])) as ContingentNumbers;
}

const toCategory = (v: unknown): ContingentCategory =>
  (CONTINGENT_CATEGORIES as readonly string[]).includes(String(v)) ? (v as ContingentCategory) : 'milliy';

const toSource = (v: unknown): CellSource => (v === 'groups' ? 'groups' : 'manual');

export function mapRow(b: BackendContingentRow): ContingentRow {
  return {
    directionId: refId(b.direction) ?? '',
    directionCode: b.directionCode ?? '',
    directionTitle: refTitle(b.direction, b.directionTitle),
    category: toCategory(b.category),
    course: num(b.course),
    ...mapNumbers(b),
    source: Object.fromEntries(PREFILL_FIELDS.map((f) => [f, toSource(b.source?.[f])])) as Record<
      PrefillField,
      CellSource
    >,
  };
}

export function mapForeignRow(b: BackendForeignRow): ForeignRow {
  return { country: b.country ?? '', total: num(b.total), boys: num(b.boys), girls: num(b.girls) };
}

function currentStepOf(steps: BackendApprovalStep[] | undefined): string | null {
  const s = (steps ?? []).find((x) => (x.status ?? 'pending') === 'pending');
  return s?.step != null ? String(s.step) : null;
}

export function mapContingentReport(b: BackendContingentReport): ContingentReport {
  return {
    id: b._id,
    facultyId: refId(b.faculty),
    facultyTitle: refTitle(b.faculty, b.facultyTitle),
    academicYearId: refId(b.academicYear),
    academicYearTitle: refTitle(b.academicYear, b.academicYearTitle),
    status: b.status ?? 'draft',
    asOfDate: b.asOfDate ?? null,
    currentStep: b.status === 'in_review' ? (b.currentStep ?? currentStepOf(b.approvalSteps)) : null,
    submittedAt: b.submittedAt ?? null,
    lastPrefilledAt: b.lastPrefilledAt ?? null,
    createdAt: b.createdAt ?? null,
  };
}

export function mapContingentReportDetail(b: BackendContingentReport): ContingentReportDetail {
  const approvalHistory = (b.approvalSteps ?? []).map(mapApprovalStep);
  const rejected = [...approvalHistory].reverse().find((s) => s.status === 'rejected');
  return {
    ...mapContingentReport(b),
    rows: (b.rows ?? []).map(mapRow),
    foreignByCountry: (b.foreignByCountry ?? []).map(mapForeignRow),
    approvalHistory,
    rejectComment: rejected?.comment ?? null,
  };
}

export function mapPrefillMeta(m: BackendPrefillMeta | null | undefined): PrefillMeta {
  return {
    directionCount: num(m?.directionCount),
    groupsCounted: num(m?.groupsCounted),
    groupsWithoutYear: num(m?.groupsWithoutYear),
    unresolvedCourse: num(m?.unresolvedCourse),
    updated: m?.updated == null ? undefined : num(m.updated),
    added: m?.added == null ? undefined : num(m.added),
    skippedManual: m?.skippedManual == null ? undefined : num(m.skippedManual),
  };
}

export function toRowInput(r: ContingentRow): ContingentRowInput {
  return {
    direction: r.directionId,
    directionCode: r.directionCode,
    directionTitle: r.directionTitle,
    category: r.category,
    course: r.course,
    ...mapNumbers(r),
  };
}

interface BackendSummaryDirection {
  key?: string;
  label?: string;
  directionTitle?: string;
  category?: string;
  rows?: Array<{ course?: number } & BackendNumbers>;
  total?: BackendNumbers;
}

interface BackendSummaryFaculty {
  facultyId?: string;
  facultyTitle?: string;
  facultyShort?: string;
  directions?: BackendSummaryDirection[];
  total?: BackendNumbers;
}

export interface BackendSummaryResponse {
  academicYearTitle?: string;
  approvedCount?: number;
  summary?: {
    facultyBlocks?: BackendSummaryFaculty[];
    grandTotal?: BackendNumbers;
    byCourse?: { rows?: Array<{ course?: number } & BackendNumbers>; total?: BackendNumbers };
    facultyByCourse?: {
      rows?: Array<{ facultyTitle?: string; facultyShort?: string; courses?: number[]; total?: number }>;
      total?: { courses?: number[]; total?: number };
    };
    countries?: { rows?: BackendForeignRow[]; total?: BackendForeignRow };
    pendingFaculties?: string[];
  };
}

const courseRow = (r: { course?: number } & BackendNumbers) => ({ course: num(r.course), ...mapNumbers(r) });

export function mapSummary(b: BackendSummaryResponse): SummaryView {
  const s = b.summary ?? {};
  return {
    academicYearTitle: b.academicYearTitle ?? '',
    approvedCount: num(b.approvedCount),
    facultyBlocks: (s.facultyBlocks ?? []).map((fb) => ({
      facultyId: fb.facultyId ?? '',
      facultyTitle: fb.facultyTitle ?? '',
      facultyShort: fb.facultyShort ?? fb.facultyTitle ?? '',
      directions: (fb.directions ?? []).map((d) => ({
        key: d.key ?? '',
        label: d.label ?? '',
        directionTitle: d.directionTitle ?? '',
        category: toCategory(d.category),
        rows: (d.rows ?? []).map(courseRow),
        total: mapNumbers(d.total ?? {}),
      })),
      total: mapNumbers(fb.total ?? {}),
    })),
    grandTotal: mapNumbers(s.grandTotal ?? {}),
    byCourse: {
      rows: (s.byCourse?.rows ?? []).map(courseRow),
      total: mapNumbers(s.byCourse?.total ?? {}),
    },
    facultyByCourse: {
      rows: (s.facultyByCourse?.rows ?? []).map((r) => ({
        facultyTitle: r.facultyTitle ?? '',
        facultyShort: r.facultyShort ?? r.facultyTitle ?? '',
        courses: (r.courses ?? []).map(num),
        total: num(r.total),
      })),
      total: {
        courses: (s.facultyByCourse?.total?.courses ?? []).map(num),
        total: num(s.facultyByCourse?.total?.total),
      },
    },
    countries: {
      rows: (s.countries?.rows ?? []).map(mapForeignRow),
      total: {
        total: num(s.countries?.total?.total),
        boys: num(s.countries?.total?.boys),
        girls: num(s.countries?.total?.girls),
      },
    },
    pendingFaculties: s.pendingFaculties ?? [],
  };
}
