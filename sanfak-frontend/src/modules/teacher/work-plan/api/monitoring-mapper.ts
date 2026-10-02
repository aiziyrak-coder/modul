import type { PersonalPlanStatus } from '../model/types';
import type { MonitoringRow } from '../model/monitoring-types';

interface BackendDepartmentRef {
  _id?: string | null;
  title?: string | null;
}

interface BackendAcademicYearRef {
  _id?: string | null;
  title?: string | null;
}

export interface BackendMonitoringRow {
  _id?: string | null;
  planId?: string | null;
  teacherId?: string | null;
  teacherName?: string | null;
  department?: BackendDepartmentRef | null;
  academicYear?: BackendAcademicYearRef | string | null;
  submitStatus?: string | null;
  totalItems?: number | null;
  completedItems?: number | null;
  completionPercent?: number | null;
  overdueCount?: number | null;
  totalResearch?: number | null;
  completedResearch?: number | null;
  totalMentoring?: number | null;
  completedMentoring?: number | null;
  totalOrg?: number | null;
  completedOrg?: number | null;
}

function extractAcademicYearTitle(
  value: BackendAcademicYearRef | string | null | undefined,
): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.title ?? null;
}

export function mapMonitoringRow(b: BackendMonitoringRow): MonitoringRow {
  return {
    planId: b.planId ?? b._id ?? null,
    teacherId: b.teacherId ?? null,
    teacherName: b.teacherName ?? null,
    departmentTitle: b.department?.title ?? null,
    academicYearTitle: extractAcademicYearTitle(b.academicYear),
    submitStatus: (b.submitStatus ?? 'draft') as PersonalPlanStatus,
    totalItems: b.totalItems ?? 0,
    completedItems: b.completedItems ?? 0,
    completionPercent: b.completionPercent ?? 0,
    overdueCount: b.overdueCount ?? 0,
    totalResearch: b.totalResearch ?? 0,
    completedResearch: b.completedResearch ?? 0,
    totalMentoring: b.totalMentoring ?? 0,
    completedMentoring: b.completedMentoring ?? 0,
    totalOrg: b.totalOrg ?? 0,
    completedOrg: b.completedOrg ?? 0,
  };
}
