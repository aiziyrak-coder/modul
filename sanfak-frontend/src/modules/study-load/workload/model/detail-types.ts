export interface WorkloadEntry {
  entryId: string | null;
  value: number;
}

export interface WorkloadRow {
  blockId: string;
  direction: string;
  section: string;
  science: string;
  course: number;
  student: number;
  group: number;
  perGroup: number;
  streamCount: number;
  semester: number;
  semTotal: number;
  semAud: number;
  lectStr: WorkloadEntry;
  lectTot: number;
  clinStr: WorkloadEntry;
  clinTot: number;
  semStr: WorkloadEntry;
  semTot: number;
  labStr: WorkloadEntry;
  pratStr: WorkloadEntry;
  labTot: number;
  pratTot: number;
  on: WorkloadEntry;
  yan: WorkloadEntry;
  missed: WorkloadEntry;
  skilled: WorkloadEntry;
  vada: WorkloadEntry;
  reception: WorkloadEntry;
  consulting: WorkloadEntry;
  openDep: WorkloadEntry;
  integral: WorkloadEntry;
  special: WorkloadEntry;
  leadership: WorkloadEntry;
  total: number;
}

export interface StaffPositionItem {
  id: string | null;
  category: string;
  slug: string;
  positions: number;
  load: number;
  totalHours: number;
  hourly: number;
}

export interface StaffPositions {
  items: StaffPositionItem[];
  totalPositions: number;
  hourly: number;
}

export interface WorkloadDetail {
  id: string;
  title: string | null;
  departmentTitle: string | null;
  academicYearTitle: string | null;
  status: string;
  rows: WorkloadRow[];
  staffPositions: StaffPositions;
  lastEditedAfterApprovalAt: string | null;
  needsRecalculation: boolean;
  version: number;
  previousVersionId: string | null;
  supersededById: string | null;
  supersededAt: string | null;
}

export interface UpdateBlockResult {
  message: string;
  blockId: string;
  previousHour: number;
  totalHour: number;
  thisSemester?: { totalHour: number; auditoriumHour: number };
}

export interface UpdateBlockPayload {
  studyWork?: {
    classTypes?: { _id: string; stream: number }[];
    items?: { _id: string; value: number }[];
  };
  otherWork?: {
    items?: { _id: string; value: number }[];
  };
  leadership?: number;
}
