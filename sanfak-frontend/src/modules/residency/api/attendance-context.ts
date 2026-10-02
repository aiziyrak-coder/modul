export interface BackendAttendanceContext {
  resident?: {
    _id?: string;
    status?: string | null;
    totalUnexcusedHours?: number | null;
    warningIssued?: boolean | null;
    expulsionOrderCreated?: boolean | null;
  } | null;
  academicYear?: string | null;
  sessions?: {
    total?: number | null;
    present?: number | null;
    absent?: number | null;
    excused?: number | null;
    unmeasured?: number | null;
    pending?: number | null;
  } | null;
  coverage?: { measured?: number | null; ratio?: number | null } | null;
}

export interface AttendanceSessionCounts {
  total: number;
  present: number;
  absent: number;
  excused: number;
  unmeasured: number;
  pending: number;
}

export interface AttendanceCoverage {
  measured: number;
  denominator: number;
  ratio: number | null;
}

export interface AttendanceContext {
  academicYear: string | null;
  residentStatus: string | null;
  unexcusedHours: number | null;
  warningIssued: boolean;
  expulsionOrderCreated: boolean;
  sessions: AttendanceSessionCounts | null;
  coverage: AttendanceCoverage | null;
}

const SESSION_COUNT_KEYS = [
  'total',
  'present',
  'absent',
  'excused',
  'unmeasured',
  'pending',
] as const;

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec | null =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Rec) : null;

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

const hours = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;

const countOf = (v: unknown): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null;

function sessionCounts(v: unknown): AttendanceSessionCounts | null {
  const s = rec(v);
  if (!s) return null;
  const out: Partial<AttendanceSessionCounts> = {};
  for (const key of SESSION_COUNT_KEYS) {
    const n = countOf(s[key]);
    if (n === null) return null;
    out[key] = n;
  }
  return out as AttendanceSessionCounts;
}

function coverageOf(
  v: unknown,
  sessions: AttendanceSessionCounts | null,
): AttendanceCoverage | null {
  const c = rec(v);
  const measured = countOf(c?.measured);
  if (!sessions || measured === null) return null;
  const denominator = sessions.total - sessions.pending;
  if (denominator < 0) return null;
  const r = c?.ratio;
  const ratio =
    denominator > 0 && typeof r === 'number' && Number.isFinite(r) && r >= 0 && r <= 1 ? r : null;
  return { measured, denominator, ratio };
}

export function mapAttendanceContext(b: unknown): AttendanceContext {
  const body = rec(b);
  const resident = rec(body?.resident);
  const sessions = sessionCounts(body?.sessions);
  return {
    academicYear: str(body?.academicYear),
    residentStatus: str(resident?.status),
    unexcusedHours: hours(resident?.totalUnexcusedHours),
    warningIssued: resident?.warningIssued === true,
    expulsionOrderCreated: resident?.expulsionOrderCreated === true,
    sessions,
    coverage: coverageOf(body?.coverage, sessions),
  };
}
