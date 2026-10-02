import { mapApprovalStep, type BackendApprovalStep } from '../../distribution/api/mapper';
import type {
  SummaryPositionGroup,
  SummaryRow,
  SummaryTotals,
  WorkloadSummary,
  WorkloadSummaryDetail,
} from '../model/types';

interface BackendRef {
  _id: string;
  title?: string | null;
  name?: string | null;
}

interface BackendPositionGroup {
  professor?: number;
  docent?: number;
  seniorTeacher?: number;
  assistant?: number;
}

export interface BackendSummaryRow {
  no?: number;
  department?: string | null;
  head?: string | null;
  total?: number;
  hourly?: number;
  forDistribution?: number;
  positions?: number;
  dh?: BackendPositionGroup;
  ts?: BackendPositionGroup;
  supportTotal?: number;
  support?: { cabinetHead?: number; laborant?: number };
}

export interface BackendWorkloadSummary {
  _id: string;
  academicYear?: BackendRef | string | null;
  academicYearTitle?: string | null;
  status?: string;
  snapshot?: {
    rows?: BackendSummaryRow[];
    totals?: BackendSummaryRow | null;
    rowCount?: number;
    generatedAt?: string | null;
    missingDepartments?: string[];
  };
  approvalSteps?: BackendApprovalStep[];
  staleness?: {
    isStale?: boolean;
    added?: number;
    changed?: number;
    removed?: number;
  } | null;
  createdAt?: string | null;
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function mapGroup(g?: BackendPositionGroup): SummaryPositionGroup {
  return {
    professor: num(g?.professor),
    docent: num(g?.docent),
    seniorTeacher: num(g?.seniorTeacher),
    assistant: num(g?.assistant),
  };
}

function mapNumbers(b: BackendSummaryRow): SummaryTotals {
  return {
    total: num(b.total),
    hourly: num(b.hourly),
    forDistribution: num(b.forDistribution),
    positions: num(b.positions),
    dh: mapGroup(b.dh),
    ts: mapGroup(b.ts),
    supportTotal: num(b.supportTotal),
    support: { cabinetHead: num(b.support?.cabinetHead), laborant: num(b.support?.laborant) },
  };
}

export function mapSummaryRow(b: BackendSummaryRow): SummaryRow {
  return {
    no: num(b.no),
    department: b.department ?? '',
    head: b.head ?? '',
    ...mapNumbers(b),
  };
}

function refId(r: BackendRef | string | null | undefined): string | null {
  if (!r) return null;
  return typeof r === 'string' ? r : r._id;
}

function refTitle(r: BackendRef | string | null | undefined, fallback: string | null | undefined): string {
  if (r && typeof r === 'object') return r.title ?? r.name ?? fallback ?? '';
  return fallback ?? '';
}

function currentStepOf(steps: BackendApprovalStep[] | undefined): string | null {
  const s = (steps ?? []).find((x) => (x.status ?? 'pending') === 'pending');
  return s?.step != null ? String(s.step) : null;
}

export function mapWorkloadSummary(b: BackendWorkloadSummary): WorkloadSummary {
  return {
    id: b._id,
    academicYearId: refId(b.academicYear),
    academicYearTitle: refTitle(b.academicYear, b.academicYearTitle),
    status: b.status ?? 'draft',
    rowCount: num(b.snapshot?.rowCount),
    totalHours: num(b.snapshot?.totals?.total),
    generatedAt: b.snapshot?.generatedAt ?? null,
    currentStep: b.status === 'in_review' ? currentStepOf(b.approvalSteps) : null,
    createdAt: b.createdAt ?? null,
  };
}

export function mapWorkloadSummaryDetail(b: BackendWorkloadSummary): WorkloadSummaryDetail {
  const approvalHistory = (b.approvalSteps ?? []).map(mapApprovalStep);
  const rejected = [...approvalHistory].reverse().find((s) => s.status === 'rejected');
  return {
    ...mapWorkloadSummary(b),
    rows: (b.snapshot?.rows ?? []).map(mapSummaryRow),
    totals: b.snapshot?.totals ? mapNumbers(b.snapshot.totals) : null,
    missingDepartments: b.snapshot?.missingDepartments ?? [],
    approvalHistory,
    staleness: b.staleness
      ? {
          isStale: Boolean(b.staleness.isStale),
          added: num(b.staleness.added),
          changed: num(b.staleness.changed),
          removed: num(b.staleness.removed),
        }
      : null,
    rejectComment: rejected?.comment ?? null,
  };
}
