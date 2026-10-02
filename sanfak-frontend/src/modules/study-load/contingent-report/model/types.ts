import type { ApprovalStep } from '../../distribution/model/types';

export const CONTINGENT_CATEGORIES = ['milliy', 'mdh', 'xorijiy', 'xorijiy_gibrid'] as const;
export type ContingentCategory = (typeof CONTINGENT_CATEGORIES)[number];

export const CONTINGENT_NUM_FIELDS = [
  'total',
  'boys',
  'girls',
  'grant',
  'contract',
  'grantBoys',
  'grantGirls',
  'contractBoys',
  'contractGirls',
  'groupCount',
  'streamCount',
  'mobilityOut',
  'mobilityIn',
] as const;
export type ContingentNumField = (typeof CONTINGENT_NUM_FIELDS)[number];

export const PREFILL_FIELDS = ['total', 'groupCount', 'streamCount'] as const;
export type PrefillField = (typeof PREFILL_FIELDS)[number];
export type CellSource = 'groups' | 'manual';

export type ContingentNumbers = Record<ContingentNumField, number>;

export interface ContingentRow extends ContingentNumbers {
  directionId: string;
  directionCode: string;
  directionTitle: string;
  category: ContingentCategory;
  course: number;
  source: Record<PrefillField, CellSource>;
}

export interface ForeignRow {
  country: string;
  total: number;
  boys: number;
  girls: number;
}

export interface ContingentReport {
  id: string;
  facultyId: string | null;
  facultyTitle: string;
  academicYearId: string | null;
  academicYearTitle: string;
  status: string;
  asOfDate: string | null;
  currentStep: string | null;
  submittedAt: string | null;
  lastPrefilledAt: string | null;
  createdAt: string | null;
}

export interface ContingentReportDetail extends ContingentReport {
  rows: ContingentRow[];
  foreignByCountry: ForeignRow[];
  approvalHistory: ApprovalStep[];
  rejectComment: string | null;
}

export interface PrefillMeta {
  directionCount: number;
  groupsCounted: number;
  groupsWithoutYear: number;
  unresolvedCourse: number;
  updated?: number;
  added?: number;
  skippedManual?: number;
}

export interface CreateReportResult {
  message: string;
  id: string;
  meta: PrefillMeta;
}

export interface PrefillResult {
  message: string;
  detail: ContingentReportDetail;
  meta: PrefillMeta;
}

export interface ApproveReportResult {
  message: string;
  action: 'submitted' | 'reopened' | 'approved_step' | 'approved';
  status: string;
}

export interface ContingentRowInput extends ContingentNumbers {
  direction: string;
  directionCode: string;
  directionTitle: string;
  category: ContingentCategory;
  course: number;
}

export interface UpdateReportPayload {
  asOfDate?: string;
  rows: ContingentRowInput[];
  foreignByCountry: ForeignRow[];
}

export interface SummaryDirectionBlock {
  key: string;
  label: string;
  directionTitle: string;
  category: ContingentCategory;
  rows: Array<{ course: number } & ContingentNumbers>;
  total: ContingentNumbers;
}

export interface SummaryFacultyBlock {
  facultyId: string;
  facultyTitle: string;
  facultyShort: string;
  directions: SummaryDirectionBlock[];
  total: ContingentNumbers;
}

export interface SummaryView {
  academicYearTitle: string;
  approvedCount: number;
  facultyBlocks: SummaryFacultyBlock[];
  grandTotal: ContingentNumbers;
  byCourse: { rows: Array<{ course: number } & ContingentNumbers>; total: ContingentNumbers };
  facultyByCourse: {
    rows: Array<{ facultyTitle: string; facultyShort: string; courses: number[]; total: number }>;
    total: { courses: number[]; total: number };
  };
  countries: { rows: ForeignRow[]; total: { total: number; boys: number; girls: number } };
  pendingFaculties: string[];
}
