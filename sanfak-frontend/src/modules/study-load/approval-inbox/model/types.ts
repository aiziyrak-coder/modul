export type ApprovalStepKey =
  | 'teacher'
  | 'kafedra'
  | 'arm'
  | 'methodical'
  | 'financial'
  | 'dean'
  | 'prorektor'
  | 'rektor';

export type ApprovalInboxEntity =
  | 'workload'
  | 'distribution'
  | 'scienceProgram'
  | 'syllabus'
  | 'workingSchedule'
  | 'workloadSummary'
  | 'contingentReport';

export interface ApprovalInboxRef {
  id: string;
  title: string;
}

export interface ApprovalInboxItem {
  entity: ApprovalInboxEntity;
  id: string;
  title: string | null;
  step: string;
  department: ApprovalInboxRef | null;
  academicYear: ApprovalInboxRef | null;
  submittedAt: string | null;
  totalHour: number | null;
}
