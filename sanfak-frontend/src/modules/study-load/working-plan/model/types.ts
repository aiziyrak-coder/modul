export interface ParticleItem {
  id: string;
  slug: string;
  title: string;
  value: number;
  canonical: string | null;
  colNum: number | null;
}

export interface ParticleLabel {
  id?: string;
  slug: string;
  title: string;
  colNum: number | null;
}

export interface ElectiveAlternative {
  scienceId: string | null;
  code: string | null;
  title: string | null;
  departmentId: string | null;
}

export type PlanRowType = 'subject' | 'sectionHeader' | 'aggregate' | 'electiveSlot';

export interface WorkingPlanScience {
  id: string;
  serialNumber: string | null;
  code: string | null;
  title: string | null;
  scienceRef: string | null;
  departmentRef: string | null;
  particle: ParticleItem[];
  totalCredit: number;
  weeklyHours: number;
  evaluationType: string | null;
  alternatives: ElectiveAlternative[];
  rowType: PlanRowType;
}

export interface WorkingPlanBlock {
  id: string;
  blockCode: string;
  serialNumber: string | null;
  code: string | null;
  title: string | null;
  sciences: WorkingPlanScience[];
}

export interface TotalRow {
  title: string | null;
  totalHour: number;
  totalCredit: number;
  weeklyHours: number;
  particles: ParticleItem[];
}

export interface PracticeRow {
  title: string | null;
  code: string | null;
  hour: number;
  credit: number;
  particles: ParticleItem[];
}

export interface SemesterData {
  semester: string | null;
  blocks: WorkingPlanBlock[];
  blocksTotal: TotalRow | null;
  practice: PracticeRow | null;
  grandTotal: TotalRow | null;
}

export interface WorkingPlanMeta {
  serialNumber: string | null;
  code: string | null;
  title: string | null;
  particles: {
    title: string;
    items: ParticleLabel[];
  } | null;
  distribution: {
    title: string;
    courses: string[];
    weekly: number[];
    semester: number[];
  } | null;
  credit: {
    title: string;
    courses: string[];
    weekly: number[];
    semester: number[];
  } | null;
  totalCredit: string | null;
  evaluationType: string | null;
  weeklyHours: string | null;
}

export interface WorkingPlan {
  id: string;
  workingScheduleId: string | null;
  workingScheduleTitle: string | null;
  studyPlanLabel: string | null;
  file: string | null;
  date: string | null;
  createdAt: string;
}

export interface WorkingPlanDetail {
  id: string;
  workingScheduleId: string | null;
  workingScheduleTitle: string | null;
  studyPlanLabel: string | null;
  meta: WorkingPlanMeta | null;
  semesters: Record<string, SemesterData>;
  semesterNumbers: Record<string, string>;
  unfilledSlots: UnfilledSlot[];
  file: string | null;
  date: string | null;
  createdAt: string;
}

export interface UnfilledSlot {
  semKey: string;
  blockId: string;
  rowId: string;
  serialNumber: string | null;
  credit: number;
  hour: number;
}

export interface ElectiveUsageCounts {
  total: number;
  signed: number;
}

export interface ElectiveSignedGroup {
  collection: string;
  count: number;
}

export interface ElectiveUsage {
  scienceProgram: ElectiveUsageCounts;
  syllabus: ElectiveUsageCounts;
  workload: ElectiveUsageCounts;
  workloadDistribution: ElectiveUsageCounts;
  total: number;
  signedTotal: number;
  signed: ElectiveSignedGroup[];
}

export interface ElectiveUsageInfo {
  elective: boolean;
  locked: boolean;
  status: string | null;
  hasStudyPlan: boolean;
  affectedWorkingPlans: number;
  lockedWorkingPlans: number;
  usage: ElectiveUsage;
  canSwap: boolean;
}

export interface ElectiveSwapResult {
  updatedPlans: number;
  updatedRows: number;
  studyPlanRows: number;
  persisted: boolean;
  persistError: string | null;
  siblingErrors: string[];
  newScienceTitle: string | null;
  newScienceCode: string | null;
  filled: boolean;
}

export interface ElectiveAlternativesResult {
  updatedRows: number;
  studyPlanRows: number;
  persisted: boolean;
  persistError: string | null;
  alternatives: ElectiveAlternative[];
}

export interface ScienceOption {
  id: string;
  title: string;
  code: string | null;
}
