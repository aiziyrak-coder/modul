import type { ApprovalStep } from '../../distribution/model/types';

export type WorkingScheduleStatus = 'draft' | 'in_review' | 'approved' | 'rejected';

export interface WorkingSchedule {
  id: string;
  title: string | null;
  directionTitle: string | null;
  courseTitle: string | null;
  academicYearTitle: string | null;
  stage: string | null;
  date: string | null;
  status: WorkingScheduleStatus;
  createdAt: string;
  file: string | null;
  approvalHistory?: ApprovalStep[];
  currentStep?: string | null;
}

export type WorkingScheduleStatusFilter = WorkingScheduleStatus | '';
