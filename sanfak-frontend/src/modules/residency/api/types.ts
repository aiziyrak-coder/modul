export type Program = 'magistratura' | 'ordinatura';
export type FundingType = 'byudjet' | 'shartnoma';
export type AttendanceStatus = 'present' | 'absent' | 'excused';
export type LessonType =
  | 'maruza'
  | 'amaliy'
  | 'test'
  | 'oraliq_nazorat'
  | 'yakuniy_nazorat';
export type DailyLogStatus = 'kutilmoqda' | 'tasdiqlangan' | 'qaytarilgan';
export type ApplicationType =
  | 'academic_leave'
  | 'attestation_postpone'
  | 'conference'
  | 'reference'
  | 'schedule_change'
  | 'other';
export type ApplicationStatus =
  | 'yangi'
  | 'korib_chiqilmoqda'
  | 'tasdiqlangan'
  | 'rad_etilgan';

export interface Specialty {
  id: string;
  title: string;
  code: string | null;
  program: Program;
  studyPeriod: number | null;
  departmentId: string | null;
  departmentTitle: string | null;
  active: boolean;
}

export type AssessmentType = 'oraliq' | 'amaliy' | 'yakuniy' | 'attestatsiya';

export interface Assessment {
  id: string;
  residentId: string;
  resident: ResidentBrief | null;
  scienceId: string | null;
  scienceTitle: string | null;
  type: AssessmentType | null;
  score: number | null;
  maxScore: number;
  assessorId: string | null;
  assessorName: string | null;
  createdAt: string | null;
}

export interface EligibilityWindow {
  source: 'academicYear' | 'explicit';
  academicYear: string | null;
  from: string | null;
  to: string | null;
}

export interface AttestationEligibility {
  eligible: boolean;
  reasons: string[];
  warningTriggered: boolean;
  expulsionTriggered: boolean;
  details: {
    attendance: { totalRecords: number; unexcusedHours: number; window?: EligibilityWindow };
    dailyLog: { total: number; approved: number; approvalRatio: number };
    assessment: { interimCount: number; avgScore: number | null };
  };
}

export interface ClinicalSkill {
  skill: string;
  targetCount: number;
  completedCount: number;
}

export interface Resident {
  id: string;
  userId: string | null;
  program: Program;

  fullName: string;
  lastName?: string;
  firstName?: string;
  middleName?: string;
  jshshir: string | null;
  passportSeria: string | null;
  passportNumber: string | null;
  address: string | null;
  workplace: string | null;
  workplaceLocation: { lat: number; lng: number } | null;
  email: string | null;
  phone: string | null;
  foreign: boolean;

  fundingType: FundingType | null;
  studyPeriod: number | null;
  academicYear: string | null;
  academicYearRef: string | null;
  courseNumber: number | null;
  admissionOrder: string | null;
  admissionDate: string | null;

  specialtyId: string | null;
  specialtyTitle: string | null;
  specialtyCode: string | null;
  departmentId: string | null;
  departmentTitle: string | null;
  groupId: string | null;
  groupTitle: string | null;

  supervisorId: string | null;
  supervisorName: string | null;
  teachingLocation: string | null;
  practiceLocation: string | null;
  scheduleText: string | null;
  weeklyHours: number | null;
  assignedAt: string | null;

  diplomaSeria: string | null;
  diplomaNumber: string | null;
  diplomaDate: string | null;
  diplomaFileUrl: string | null;

  clinicalSkillsPlan: ClinicalSkill[];

  totalUnexcusedHours: number;
  warningIssued: boolean;
  expulsionOrderCreated: boolean;
  active: boolean;
}

export interface ResidentBrief {
  id: string;
  fullName: string;
  program: Program;
  specialtyTitle: string | null;
  departmentTitle: string | null;
  courseNumber: number | null;
  groupId: string | null;
  groupTitle: string | null;
}

export interface Attendance {
  id: string;
  residentId: string;
  resident: ResidentBrief | null;
  date: string;
  scienceId: string | null;
  scienceTitle: string | null;
  lessonType: LessonType | null;
  teacherId: string | null;
  teacherName: string | null;
  groupId: string | null;
  status: AttendanceStatus;
  hours: number;
  score: number | null;
  samsVerified: boolean;
  manualVerified: boolean;
  checkInTime: string | null;
  checkOutTime: string | null;
  late: boolean;
  lateMinutes: number | null;
  excuseReason: string | null;
  fromDate: string | null;
  toDate: string | null;
  application: AttendanceApplication | null;
}

export type AttendanceWrite = Partial<
  Omit<Attendance, 'samsVerified' | 'manualVerified' | 'checkInTime' | 'checkOutTime'>
>;

export interface AttendanceApplication {
  id: string;
  fileUrl: string | null;
  reason: string | null;
  type: ApplicationType | null;
  status: ApplicationStatus | null;
}

export interface AttendanceStats {
  stats: Array<{ status: AttendanceStatus; count: number; totalHours: number }>;
  summary: {
    fullName?: string;
    totalUnexcusedHours: number;
    warningIssued: boolean;
    expulsionOrderCreated: boolean;
  } | null;
}

export interface SkillEntry {
  skillId?: string | null;
  skill: string | null;
  count?: number;
}

export interface DailyLog {
  id: string;
  residentId: string;
  resident: ResidentBrief | null;
  date: string;
  workType: string | null;
  semester: string | null;
  clinicalWork: string | null;
  skills: SkillEntry[];
  fileUrl: string | null;
  status: DailyLogStatus;
  supervisorName: string | null;
  supervisorComment: string | null;
  comment: string | null;
}

export interface DailyLogStats {
  total: number;
  kutilmoqda: number;
  tasdiqlangan: number;
  qaytarilgan: number;
}

export interface Application {
  id: string;
  residentId: string;
  resident: ResidentBrief | null;
  type: ApplicationType;
  reason: string | null;
  academicYear: string | null;
  academicYearRef: string | null;
  fileUrl: string | null;
  status: ApplicationStatus;
  comment: string | null;
  fromDate: string | null;
  toDate: string | null;
  reviewedByName: string | null;
  createdAt: string | null;
}

export interface ApplicationStats {
  total: number;
  yangi: number;
  korib_chiqilmoqda: number;
  tasdiqlangan: number;
  rad_etilgan: number;
  pending: number;
}

export interface UserOption {
  id: string;
  name: string;
  roleTitle: string;
  departmentId: string | null;
}

export interface RefOption {
  id: string;
  title: string;
}

export interface JournalStats {
  present: number;
  absent: number;
  excused: number;
  late: number;
  total: number;
  percent: number;
}

export interface ResidentRollup {
  residentId: string;
  resident: { fullName: string | null; specialtyTitle: string | null; courseNumber: number | null } | null;
  total: number;
  present: number;
  absent: number;
  excused: number;
  late: number;
  scoreSum: number;
  scoreAvg: number | null;
  scoredCount: number;
  lastDate: string;
}
