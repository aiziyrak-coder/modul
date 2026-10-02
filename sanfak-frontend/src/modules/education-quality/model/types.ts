export type FieldType =
  | 'text'
  | 'number'
  | 'money'
  | 'date'
  | 'select'
  | 'url'
  | 'textarea'
  | 'file';

export interface DataField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
}

export interface Indicator {
  _id: string;
  title: string;
  desc: string | null;
  coefficient: number;
  dataFields: DataField[];
  category: string | null;
  order: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IndicatorInput {
  title: string;
  desc?: string;
  coefficient: number;
  dataFields: DataField[];
  category?: string;
  order?: number;
  active?: boolean;
}

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface SubmissionTeacher {
  _id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  department?: { _id: string; title: string };
  faculty?: { _id: string; title: string };
  position?: { _id: string; title: string };
}

export type Semester = 1 | 2;

export interface Submission {
  _id: string;
  teacher: SubmissionTeacher;
  indicator: Pick<Indicator, '_id' | 'title' | 'coefficient'>;
  academicYear: { _id: string; title: string } | null;
  semester: Semester | null;
  data: Record<string, unknown>;
  files: string[];
  status: SubmissionStatus;
  score: number;
  authorShare: number;
  reviewedBy: { _id: string; firstName: string; lastName: string } | null;
  comment: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubmissionInput {
  indicator: string;
  academicYear?: string;
  semester?: Semester;
  data: Record<string, unknown>;
  authorShare: number;
}

export interface ReviewInput {
  status: 'approved' | 'rejected';
  score?: number;
  comment?: string;
}

export interface Announcement {
  _id: string;
  title: string;
  content: string;
  author: { _id: string; firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

export interface AnnouncementInput {
  title: string;
  content: string;
}

export interface RankingMetrics {
  teacherCount: number;
  totalScore: number;
  avgScore: number;
  redCount: number;
  redShare: number;
}

export interface FacultyReport extends RankingMetrics {
  _id: string;
  faculty: string;
  departmentCount: number;
}

export interface DepartmentReport extends RankingMetrics {
  _id: string;
  department: string;
  faculty: string;
  facultyId: string | null;
}

export interface TeacherAccess {
  active: boolean;
  activeFrom: string | null;
}

export interface TeacherProfile extends TeacherAccess {
  _id: string;
  fullName: string;
  department: string;
  faculty: string;
  position: string;
}

export type EmploymentType = 'asosiy' | 'orindosh';

export interface TeacherReport extends TeacherAccess {
  _id: string;
  teacher: string;
  department: string;
  faculty: string;
  indicatorCount: number;
  totalScore: number;
  employmentType: EmploymentType | null;
}

export interface TeacherScoreDetail {
  indicator: string;
  authorCount: number;
  score: number;
}
