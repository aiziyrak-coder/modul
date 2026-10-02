import type { AssignmentBasis, BlockJustification, SuitabilityFlag } from '../lib/suitability';

export interface Distribution {
  id: string;
  title: string | null;
  departmentTitle: string | null;
  academicYearTitle: string | null;
  scienceNumber: number;
  totalHour: number;
  residueHour: number;
  course: number;
  status: string;
  date: string | null;
}

export interface ClassTypeEntry {
  slug: string;
  title?: string | null;
  canonical: string | null;
  colNum?: number | null;
  stream: number;
  total: number;
}

export interface StudyWorkItem {
  slug: string;
  title?: string | null;
  canonical: string | null;
  colNum?: number | null;
  value: number;
}

export interface ThisSemesterWork {
  totalHour: number;
  auditoriumHour: number;
}

export interface BlockStudyWork {
  thisSemester: ThisSemesterWork;
  classTypes: ClassTypeEntry[];
  items: StudyWorkItem[];
  group: number;
  stream: number;
}

export interface DistributionBlock {
  id: string;
  scienceId: string | null;
  scienceName: string | null;
  course: number;
  semester: number;
  groupCount: number;
  streamCount: number;
  studentCount: number;
  semTotalHour: number;
  auditoriumHour: number;
  classTypes: ClassTypeEntry[];
  studyWorkItems: StudyWorkItem[];
  totalHour: number;
  workloadBlockId: string | null;
  groupIds: string[];
  suitability: SuitabilityFlag;
  justification: BlockJustification;
  classTypeSlugs: string[];
}

export type TeacherAcceptanceStatus = 'pending' | 'accepted' | 'rejected';

export interface DistributionTeacher {
  id: string;
  userId: string | null;
  fullName: string;
  stavka: number;
  position: string | null;
  isVacant: boolean;
  vacantLabel: string | null;
  blocks: DistributionBlock[];
  totalHour: number;
  auditoriumHour: number | null;
  minHour: number | null;
  maxHour: number | null;
  acceptanceStatus: TeacherAcceptanceStatus;
  rejectionReason: string | null;
  respondedAt: string | null;
}

export interface DistributionDetail {
  id: string;
  title: string | null;
  departmentName: string | null;
  workloadTitle: string | null;
  workloadDate: string | null;
  academicYearTitle: string | null;
  scienceNumber: number;
  totalHour: number;
  residueHour: number;
  status: string;
  date: string | null;
  teachers: DistributionTeacher[];
  workloadId: string | null;
  approvalHistory: ApprovalStep[];
  allowedStakes: number[];
}

export interface ApprovalStep {
  step: string | number;
  label: string;
  approverName: string | null;
  status: 'pending' | 'approved' | 'rejected';
  date: string | null;
  comment: string | null;
}

export interface DistributionFormValues {
  workload: string;
}

export interface WorkloadOption {
  id: string;
  label: string;
}

export interface WorkloadBlockOption {
  id: string;
  scienceName: string | null;
  course: number;
  semester: number;
  totalHour: number;
  directionId: string | null;
  academicYearId: string | null;
  groupIds: string[];
  classTypes: ClassTypeEntry[];
  studyWorkItems: StudyWorkItem[];
  isLastSemester: boolean;
  nonAuditHour: number;
  scienceDepartmentId: string | null;
  departmentId: string | null;
  streamCount: number | null;
  groupCount: number | null;
}

export interface TeacherOption {
  id: string;
  fullName: string;
  departmentId: string | null;
  departmentTitle: string | null;
  specialtyName: string | null;
  specialtyCode: string | null;
  academicDegree: string | null;
}

export interface GroupOption {
  id: string;
  title: string;
  directionId: string | null;
  courseNumber: number | null;
  academicYearId: string | null;
  studentNumber: number | null;
}

export interface StreamInput {
  number: number;
  groups: string[];
  language?: string | null;
}

export interface AddTeacherPayload {
  teacher?: string | null;
  stavka: number;
  position?: string | null;
  specialization?: string | null;
  phone?: string | null;
  isVacant?: boolean;
  vacantLabel?: string | null;
  vacancyReason?: string | null;
  vacancy?: {
    requiredPosition?: string | null;
    requiredSpecialization?: string | null;
    requiredAcademicTitle?: string | null;
    deadline?: string | null;
  };
}

export interface AddBlockPayload {
  workloadBlockId: string;
  semester: number;
  subGroup?: number;
  groups?: string[];
  streams?: StreamInput[];
  classTypeSlugs?: string[];
  suitabilityBasis?: AssignmentBasis;
  suitabilityNote?: string;
}

export interface VacateTeacherPayload {
  reason?: string | null;
  requiredPosition?: string | null;
  requiredSpecialization?: string | null;
  requiredAcademicTitle?: string | null;
  deadline?: string | null;
}

export interface FillVacancyPayload {
  teacher: string;
  position?: string | null;
  specialization?: string | null;
  phone?: string | null;
  stavka?: number | null;
  suitabilityBasis?: AssignmentBasis;
  suitabilityNote?: string;
}

export interface VacancyRef {
  id: string;
  title: string;
}

export interface VacancyBlock {
  science: string | null;
  scienceTitle: string | null;
  course: number;
  semester: number;
  totalHour: number;
}

export interface ElectiveOption {
  scienceId: string | null;
  code: string | null;
  title: string | null;
  departmentId: string | null;
  selectable: boolean;
  reason: string | null;
  suitability: SuitabilityFlag;
}

export interface ElectiveOptions {
  main: ElectiveOption | null;
  alternatives: ElectiveOption[];
}

export interface ElectiveChoiceResult {
  blockId: string;
  scienceId: string | null;
  electiveSlotScienceId: string | null;
  totalHour: number;
}

export interface VacancyLeave {
  type: string;
  fromDate: string | null;
  toDate: string | null;
}

export interface Vacancy {
  distributionId: string;
  distributionTitle: string | null;
  distributionStatus: string;
  course: number;
  department: VacancyRef | null;
  academicYear: VacancyRef | null;
  teacherEntryId: string;
  vacancyNumber: number | null;
  vacantLabel: string | null;
  vacancyReason: string | null;
  vacantSince: string | null;
  leave: VacancyLeave | null;
  totalHour: number;
  blocks: VacancyBlock[];
  requiredPosition: string | null;
  requiredSpecialization: string | null;
  requiredAcademicTitle: string | null;
  deadline: string | null;
  postedAt: string | null;
}
