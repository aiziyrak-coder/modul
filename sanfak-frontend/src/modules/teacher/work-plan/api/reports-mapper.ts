import type {
  PersonalReport,
  ReportApprovalStep,
  ReportApprovalStepKey,
  ReportApprovalStepStatus,
  ReportFormValues,
  ReportStatus,
} from '../model/report-types';

interface BackendTeacher {
  _id: string;
  firstName?: string | null;
  lastName?: string | null;
  middleName?: string | null;
}

interface BackendAcademicYear {
  _id: string;
  title?: string | null;
}

interface BackendReportApprovalStep {
  step: string;
  label?: string | null;
  approvedBy?: string | { _id: string; firstName?: string; lastName?: string } | null;
  status?: ReportApprovalStepStatus;
  date?: string | null;
  comment?: string | null;
}

export interface BackendPersonalReport {
  _id: string;
  plan: string | { _id: string };
  teacher?: BackendTeacher | null;
  academicYear?: BackendAcademicYear | string | null;
  semester: number;
  text: string;
  councilDecisionFile?: string | null;
  status?: ReportStatus;
  approvals?: BackendReportApprovalStep[];
  createdAt?: string | null;
}

export interface BackendReportMutationResponse {
  message: string;
  data: BackendPersonalReport;
}

function extractPlanId(plan: string | { _id: string }): string {
  return typeof plan === 'string' ? plan : plan._id;
}

function extractTeacherName(teacher: BackendTeacher | null | undefined): string | null {
  if (!teacher) return null;
  return [teacher.lastName, teacher.firstName].filter(Boolean).join(' ') || null;
}

function extractAcademicYearId(
  ay: BackendAcademicYear | string | null | undefined,
): string | null {
  if (!ay) return null;
  if (typeof ay === 'string') return ay;
  return ay._id;
}

function extractAcademicYearTitle(
  ay: BackendAcademicYear | string | null | undefined,
): string | null {
  if (!ay || typeof ay === 'string') return null;
  return ay.title ?? null;
}

function extractApprovedById(
  approvedBy: string | { _id: string } | null | undefined,
): string | null {
  if (!approvedBy) return null;
  if (typeof approvedBy === 'string') return approvedBy;
  return approvedBy._id;
}

function extractApprovedByName(
  approvedBy: string | { firstName?: string; lastName?: string } | null | undefined,
): string | null {
  if (!approvedBy || typeof approvedBy === 'string') return null;
  const name = [approvedBy.lastName, approvedBy.firstName].filter(Boolean).join(' ');
  return name || null;
}

function mapApprovalStep(b: BackendReportApprovalStep): ReportApprovalStep {
  return {
    step: b.step as ReportApprovalStepKey,
    label: b.label ?? b.step,
    status: b.status ?? 'pending',
    approvedById: extractApprovedById(b.approvedBy),
    approvedByName: extractApprovedByName(b.approvedBy),
    date: b.date ?? null,
    comment: b.comment ?? null,
  };
}

export function mapPersonalReport(b: BackendPersonalReport): PersonalReport {
  return {
    id: b._id,
    planId: extractPlanId(b.plan),
    teacherId: b.teacher?._id ?? null,
    teacherName: extractTeacherName(b.teacher),
    academicYearId: extractAcademicYearId(b.academicYear),
    academicYearTitle: extractAcademicYearTitle(b.academicYear),
    semester: b.semester,
    text: b.text,
    councilDecisionFile: b.councilDecisionFile ?? null,
    status: b.status ?? 'draft',
    approvals: (b.approvals ?? []).map(mapApprovalStep),
    createdAt: b.createdAt ?? null,
  };
}

export function getReportRejectionComment(report: PersonalReport): string | null {
  const rejectedStep = report.approvals.find((s) => s.status === 'rejected');
  return rejectedStep?.comment ?? null;
}

export function toCreateReportPayload(
  values: ReportFormValues,
  planId: string,
  academicYearId: string,
): Record<string, unknown> {
  return {
    plan: planId,
    academicYear: academicYearId,
    semester: values.semester,
    text: values.text.trim(),
    councilDecisionFile: values.councilDecisionFile.trim() || undefined,
  };
}

export function toUpdateReportPayload(values: ReportFormValues): Record<string, unknown> {
  return {
    semester: values.semester,
    text: values.text.trim(),
    councilDecisionFile: values.councilDecisionFile.trim() || null,
  };
}
