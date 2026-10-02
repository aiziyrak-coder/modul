import type { PersonalPlanStatus } from './types';

export interface MonitoringRow {
  planId: string | null;
  teacherId: string | null;
  teacherName: string | null;
  departmentTitle: string | null;
  academicYearTitle: string | null;
  submitStatus: PersonalPlanStatus | string;
  totalItems: number;
  completedItems: number;
  completionPercent: number;
  overdueCount: number;
  totalResearch: number;
  completedResearch: number;
  totalMentoring: number;
  completedMentoring: number;
  totalOrg: number;
  completedOrg: number;
}

export interface MonitoringFilter {
  page: number;
  limit: number;
  search?: string;
  academicYear?: string;
  status?: PersonalPlanStatus | '';
}
