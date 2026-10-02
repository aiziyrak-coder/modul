export const MAX_COURSE = 7;
export const MAX_STREAMS = 50;
export const MAX_NOTE = 500;

export interface DeptContingentListItem {
  id: string;
  departmentId: string | null;
  departmentTitle: string;
  academicYearId: string | null;
  academicYearTitle: string;
  rowCount: number;
  streamCount: number;
  updatedAt: string | null;
}

export interface ContingentGroup {
  id: string;
  title: string;
  langId: string | null;
  langTitle: string;
  studentNumber: number;
  inactive: boolean;
  missing: boolean;
}

export interface ContingentStream {
  number: number;
  groups: ContingentGroup[];
  languageIds: string[];
}

export interface RowDerived {
  groupCount: number;
  studentCount: number;
  streamCount: number;
}

export interface DeptContingentRow {
  key: string;
  directionId: string;
  directionTitle: string;
  directionCode: string;
  courseNum: number;
  streams: ContingentStream[];
  note: string | null;
  derived: RowDerived;
  problems: string[];
}

export interface DeptContingentDetail {
  id: string;
  departmentId: string | null;
  departmentTitle: string;
  academicYearId: string | null;
  academicYearTitle: string;
  updatedAt: string | null;
  rows: DeptContingentRow[];
}

export interface StreamDraft {
  number: number;
  groupIds: string[];
}

export interface RowDraft {
  directionId: string;
  courseNum: number;
  streams: StreamDraft[];
  note: string;
}

export interface PrefillSuggestion {
  directionId: string;
  courseNum: number;
  streams: StreamDraft[];
  groups: ContingentGroup[];
}

export interface RowInput {
  direction: string;
  courseNum: number;
  streams: Array<{ number: number; groups: string[] }>;
  note?: string | null;
}

export interface SaveResult {
  message: string;
  detail: DeptContingentDetail;
  flaggedWorkloads: number;
}

export interface DeleteResult {
  message: string;
  flaggedWorkloads: number;
}

export interface SummaryDepartmentRow extends RowDerived {
  directionId: string;
  directionTitle: string;
  courseNum: number;
  courseId: string | null;
  joinKey: string;
}

export interface SummaryDepartment {
  departmentId: string;
  departmentTitle: string;
  updatedAt: string | null;
  rows: SummaryDepartmentRow[];
}

export interface SummaryCohort {
  directionId: string;
  directionTitle: string;
  courseId: string;
  courseTitle: string;
  courseNum: number;
  joinKey: string;
  groupCount: number;
  studentCount: number;
}

export interface SummaryView {
  departments: SummaryDepartment[];
  cohorts: SummaryCohort[];
  missingDepartments: Array<{ id: string; title: string }>;
  totals: { withContingent: number; expected: number };
}
