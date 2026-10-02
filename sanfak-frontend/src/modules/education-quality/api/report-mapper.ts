import type {
  DepartmentReport,
  EmploymentType,
  FacultyReport,
  TeacherReport,
} from '../model/types';

const ACCESS_DEFAULT = { active: true, activeFrom: null } as const;

interface BackendRanking {
  totalScore?: number;
  teacherCount?: number;
  avgScore?: number;
  redCount?: number;
  redShare?: number;
}

function toMetrics(raw: BackendRanking) {
  return {
    teacherCount: raw.teacherCount ?? 0,
    totalScore: round2(raw.totalScore ?? 0),
    avgScore: round2(raw.avgScore ?? 0),
    redCount: raw.redCount ?? 0,
    redShare: raw.redShare ?? 0,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface BackendFacultyReport extends BackendRanking {
  facultyId?: string | null;
  facultyName?: string;
  departmentCount?: number;
}

export function toFacultyReport(raw: BackendFacultyReport): FacultyReport {
  return {
    _id: String(raw.facultyId ?? ''),
    faculty: raw.facultyName ?? '',
    departmentCount: raw.departmentCount ?? 0,
    ...toMetrics(raw),
  };
}

export interface BackendDepartmentReport extends BackendRanking {
  departmentId?: string | null;
  departmentName?: string;
  facultyId?: string | null;
  facultyName?: string;
}

export function toDepartmentReport(raw: BackendDepartmentReport): DepartmentReport {
  return {
    _id: String(raw.departmentId ?? ''),
    department: raw.departmentName ?? '',
    faculty: raw.facultyName ?? '',
    facultyId: raw.facultyId ? String(raw.facultyId) : null,
    ...toMetrics(raw),
  };
}

export interface BackendTeacherReport {
  teacherId?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  departmentName?: string;
  facultyName?: string;
  totalScore?: number;
  indicatorCount?: number;
  employmentType?: string | null;
}

export function toTeacherReport(raw: BackendTeacherReport): TeacherReport {
  return {
    _id: String(raw.teacherId ?? ''),
    teacher: [raw.lastName, raw.firstName, raw.middleName].filter(Boolean).join(' '),
    department: raw.departmentName ?? '',
    faculty: raw.facultyName ?? '',
    indicatorCount: raw.indicatorCount ?? 0,
    totalScore: round2(raw.totalScore ?? 0),
    employmentType:
      raw.employmentType === 'asosiy' || raw.employmentType === 'orindosh'
        ? (raw.employmentType as EmploymentType)
        : null,
    ...ACCESS_DEFAULT,
  };
}

export interface ReportQuery {
  academicYear?: string;
  semester?: number;
  indicator?: string;
  faculty?: string;
  department?: string;
  search?: string;
  employmentType?: string;
  teacher?: string;
  status?: string;
}

export function toReportParams(q: ReportQuery): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (q.academicYear) out.academicYear = q.academicYear;
  if (q.semester) out.semester = q.semester;
  if (q.indicator) out.indicator = q.indicator;
  if (q.faculty) out.faculty = q.faculty;
  if (q.department) out.department = q.department;
  if (q.employmentType) out.employmentType = q.employmentType;
  if (q.teacher) out.teacher = q.teacher;
  if (q.status) out.status = q.status;
  const term = q.search?.trim();
  if (term) out.search = term;
  return out;
}
