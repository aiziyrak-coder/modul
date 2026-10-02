export type ReportStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export const REPORT_SIGNABLE_STATUSES: readonly ReportStatus[] = ['submitted'];

export const REPORT_EDITABLE_STATUSES: readonly ReportStatus[] = ['draft', 'rejected'];

export type ReportApprovalStepKey = 'dekan' | 'kotib';
export type ReportApprovalStepStatus = 'pending' | 'approved' | 'rejected';

export interface ReportApprovalStep {
  step: ReportApprovalStepKey;
  label: string;
  status: ReportApprovalStepStatus;
  approvedById: string | null;
  approvedByName: string | null;
  date: string | null;
  comment: string | null;
}

export interface PersonalReport {
  id: string;
  planId: string;
  teacherId: string | null;
  teacherName: string | null;
  academicYearId: string | null;
  academicYearTitle: string | null;
  semester: number;
  text: string;
  councilDecisionFile: string | null;
  status: ReportStatus;
  approvals: ReportApprovalStep[];
  createdAt: string | null;
}

export interface ReportFormValues {
  semester: number | null;
  text: string;
  councilDecisionFile: string;
}
