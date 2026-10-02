export interface Workload {
  id: string;
  title: string | null;
  departmentId: string | null;
  departmentTitle: string | null;
  academicYearId: string | null;
  academicYearTitle: string | null;
  totalLectures: number;
  totalHours: number;
  status: string;
  date: string | null;
  currentStep: string | null;
  lastEditedAfterApprovalAt: string | null;
  needsRecalculation: boolean;
  version: number;
  previousVersionId: string | null;
  supersededById: string | null;
  supersededAt: string | null;
}

export interface WorkloadFormValues {
  department: string;
  academicYear: string;
}

export interface RefOption {
  id: string;
  title: string;
}

export interface WorkloadCreateWarning {
  code: string;
  message: string;
  academicYear?: string;
  direction?: string;
}

export interface CreateWorkloadResult {
  message: string;
  _id: string;
  directionsCount: number;
  totalBlocks: number;
  warnings: WorkloadCreateWarning[];
  version?: number;
}
