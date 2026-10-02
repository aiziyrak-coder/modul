import type { ActivitySection, VerificationStatus } from './types';

export interface CompletedWorkItem {
  planId: string;
  section: ActivitySection;
  itemId: string;
  title: string;
  teacherName: string | null;
  academicYearTitle: string | null;
  completedAt: string | null;
  link: string | null;
  fileUrl: string | null;
  verification: {
    status: VerificationStatus;
    comment: string | null;
  };
}

export interface CompletedItemsFilter {
  page: number;
  limit: number;
  search?: string;
  academicYear?: string;
  verificationStatus?: VerificationStatus | '';
}

export type VerifyDecision = 'approved' | 'rejected';
