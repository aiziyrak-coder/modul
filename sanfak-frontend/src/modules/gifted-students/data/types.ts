export type Role = 'student' | 'department' | 'management' | 'judge' | 'advisor';

export interface MockUser {
  id: string;
  role: Role;
  name: string;
  avatar: string | null;
  faculty?: string;
  direction?: string;
  course?: number;
  group?: string;
  email?: string;
  phone?: string;
  advisorId?: string;
  position?: string;
  department?: string;
  degree?: string;
}

export interface CriterionCategory {
  id: string;
  name: string;
  points: number;
  active: boolean;
}

export interface Criterion {
  id: string;
  name: string;
  icon: string;
  active: boolean;
  ball?: number;
  categories: CriterionCategory[];
}

export interface ReviewHistoryEntry {
  status: string;
  note: string;
  reviewedAt: string | null;
  supersededAt: string | null;
}

export interface Activity {
  id: string;
  studentId: string;
  studentName: string;
  faculty: string;
  direction?: string;
  course?: number;
  criteriaId: string;
  criteriaName: string;
  criteriaDesc?: string;
  categoryId: string;
  categoryName: string;
  title: string;
  description: string;
  note?: string;
  status: string;
  points: number;
  submittedAt: string;
  reviewedAt: string | null;
  reviewNote: string;
  reviewHistory: ReviewHistoryEntry[];
  fileUrl: string;
  fileName: string;
  link: string;
}

export interface ScholarshipCriterion {
  criteriaId: string;
  categoryIds?: string[];
  pointOverrides?: Record<string, number>;
  typePointOverride?: number;
}

export interface Scholarship {
  id: string;
  name: string;
  description: string;
  type: 'general' | 'nomdor' | 'rektor';
  minScore: number;
  amount: string;
  deadline: string;
  academicYear?: string;
  active: boolean;
  allowedCourses?: string[];
  judges?: string[];
  criteria?: ScholarshipCriterion[];

  scoringComplete?: boolean;

  canApply?: boolean;
  canApplyReason?: string | null;
}

export interface ScholarshipApplication {
  id: string;
  studentId: string;
  scholarshipId: string;
  scholarshipName: string;
  status: string;
  appliedAt: string;
  reviewedAt: string | null;
  academicYear: string;
  note: string;
  judgeScores?: Record<string, Record<string, number>>;
  studentName?: string;
  faculty?: string;
  direction?: string;
  course?: number;
  group?: string;
}

export interface DocumentType {
  id: string;
  title: string;
  description: string;
  active: boolean;
  personal: boolean;
}

export interface Advisor {
  id: string;
  name: string;
  avatar: string | null;
  degree: string;
  department: string;
  position: string;
  email: string;
  phone: string;
  office: string;
  workingHours: string;
  publications: number;
  hIndex: number;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  read: boolean;
  type: string;
  fileUrl?: string | null;
  fileName?: string | null;
}

export interface RankingStudent {
  id: string;
  name: string;
  faculty: string;
  direction: string;
  course: number;
  group: string;
  totalScore: number;
  yearScore: number;
  activitiesCount: number;
  approvedCount: number;
  rank: number;
  academicYear: string;
}

export interface ChartDatum {
  faculty: string;
  avgScore: number;
  students: number;
}

export interface ChangelogEntry {
  id: string;
  user: string;
  action: string;
  timestamp: string;
}

export interface Professor {
  id: string;
  name: string;
  degree: string;
}

export interface Kafedra {
  id: string;
  name: string;
  professors: Professor[];
}

export interface Faculty {
  id: string;
  name: string;
  kafedras: Kafedra[];
}

export interface StudentRecord {
  id: string;
  userId?: string;
  name: string;
  lastName?: string;
  firstName?: string;
  middleName?: string;
  passport: { series: string; number: string };
  jshshir: string;
  email?: string;
  phone?: string;
  workplace?: string;
  faculty: string;
  direction: string;
  course: number;
  group: string;
  academicYear: string;
  advisorId: string;
  advisorName: string;
  facultyId?: string;
  directionId?: string;
  groupId?: string;
  totalScore?: number;
  yearScore?: number;
  scoresByYear?: Record<string, number>;
  rank?: number;
}

export type GroupsByFacultyCourse = Record<string, Record<number, string[]>>;
