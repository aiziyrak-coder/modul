import type { ApprovalStep } from '../../distribution/model/types';

export interface WorkloadSummary {
  id: string;
  academicYearId: string | null;
  academicYearTitle: string;
  status: string;
  rowCount: number;
  totalHours: number;
  generatedAt: string | null;
  currentStep: string | null;
  createdAt: string | null;
}

export interface SummaryPositionGroup {
  professor: number;
  docent: number;
  seniorTeacher: number;
  assistant: number;
}

export interface SummaryRow {
  no: number;
  department: string;
  head: string;
  total: number;
  hourly: number;
  forDistribution: number;
  positions: number;
  dh: SummaryPositionGroup;
  ts: SummaryPositionGroup;
  supportTotal: number;
  support: { cabinetHead: number; laborant: number };
}

export type SummaryTotals = Omit<SummaryRow, 'no' | 'department' | 'head'>;

export interface SummaryStaleness {
  isStale: boolean;
  added: number;
  changed: number;
  removed: number;
}

export interface WorkloadSummaryDetail extends WorkloadSummary {
  rows: SummaryRow[];
  totals: SummaryTotals | null;
  missingDepartments: string[];
  approvalHistory: ApprovalStep[];
  staleness: SummaryStaleness | null;
  rejectComment: string | null;
}

export interface CreateSummaryResult {
  message: string;
  id: string;
}

export interface ApproveSummaryResult {
  message: string;
  action: 'submitted' | 'reopened' | 'approved_step' | 'approved';
  status: string;
}
