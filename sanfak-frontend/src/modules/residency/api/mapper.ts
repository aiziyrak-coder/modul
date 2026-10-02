import type {
  Application,
  Assessment,
  AssessmentType,
  Attendance,
  AttendanceApplication,
  AttendanceStats,
  AttendanceWrite,
  JournalStats,
  ResidentRollup,
  ClinicalSkill,
  DailyLog,
  RefOption,
  Resident,
  ResidentBrief,
  SkillEntry,
  Specialty,
  UserOption,
} from './types';
import { nameOf } from './user-name';
import { codeOrSnapshot, nameOrSnapshot, titleOrSnapshot } from './ref-title';

interface RawRef {
  _id: string;
  title?: string;
  name?: string;
  code?: string;
  program?: string;
}
interface RawUser {
  _id: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  department?: string | { _id: string } | null;
  role?: { title?: string; name?: string };
}
type MaybeRef = string | RawRef | null | undefined;
type MaybeUser = string | RawUser | null | undefined;

const idOf = (r: MaybeRef | MaybeUser): string | null =>
  r && typeof r === 'object' ? r._id : (r ?? null);
const titleOf = (r: MaybeRef): string | null =>
  r && typeof r === 'object' ? (r.title ?? r.name ?? null) : null;

export interface BackendSpecialty {
  _id: string;
  title: string;
  code: string | null;
  program: string;
  studyPeriod?: number | null;
  department?: MaybeRef;
  departmentTitle?: string | null;
  active: boolean;
}
export const mapSpecialty = (b: BackendSpecialty): Specialty => ({
  id: b._id,
  title: b.title,
  code: b.code ?? null,
  program: b.program === 'magistratura' ? 'magistratura' : 'ordinatura',
  studyPeriod: typeof b.studyPeriod === 'number' ? b.studyPeriod : null,
  departmentId: idOf(b.department),
  departmentTitle: titleOrSnapshot(b.department, b.departmentTitle),
  active: b.active !== false,
});
export const toSpecialtyPayload = (s: Partial<Specialty>): Record<string, unknown> => ({
  title: s.title,
  code: s.code ?? null,
  program: s.program,
  studyPeriod: s.studyPeriod ?? null,
  department: s.departmentId || null,
  departmentTitle: s.departmentTitle ?? null,
  ...(s.active !== undefined ? { active: s.active } : {}),
});

export interface BackendResident {
  _id: string;
  user?: MaybeUser;
  program: string;
  fullName: string;
  jshshir?: string | null;
  passportSeria?: string | null;
  passportNumber?: string | null;
  address?: string | null;
  workplace?: string | null;
  workplaceLocation?: { lat: number; lng: number } | null;
  email?: string | null;
  phone?: string | null;
  foreign?: boolean;
  fundingType?: string | null;
  studyPeriod?: number | null;
  academicYear?: string | null;
  academicYearRef?: string | null;
  courseNumber?: number | null;
  admissionOrder?: string | null;
  admissionDate?: string | null;
  specialty?: MaybeRef;
  specialtyTitle?: string | null;
  specialtyCode?: string | null;
  department?: MaybeRef;
  departmentTitle?: string | null;
  group?: MaybeRef;
  groupTitle?: string | null;
  supervisor?: MaybeUser;
  supervisorName?: string | null;
  teachingLocation?: string | null;
  practiceLocation?: string | null;
  scheduleText?: string | null;
  weeklyHours?: number | null;
  assignedAt?: string | null;
  diplomaSeria?: string | null;
  diplomaNumber?: string | null;
  diplomaDate?: string | null;
  diplomaFileUrl?: string | null;
  clinicalSkillsPlan?: ClinicalSkill[];
  totalUnexcusedHours?: number;
  warningIssued?: boolean;
  expulsionOrderCreated?: boolean;
  active?: boolean;
}

const asProgram = (p: string): Resident['program'] =>
  p === 'magistratura' ? 'magistratura' : 'ordinatura';

export const mapResident = (b: BackendResident): Resident => ({
  id: b._id,
  userId: idOf(b.user),
  program: asProgram(b.program),
  fullName: b.fullName,
  jshshir: b.jshshir ?? null,
  passportSeria: b.passportSeria ?? null,
  passportNumber: b.passportNumber ?? null,
  address: b.address ?? null,
  workplace: b.workplace ?? null,
  workplaceLocation: b.workplaceLocation ?? null,
  email: b.email ?? null,
  phone: b.phone ?? null,
  foreign: !!b.foreign,
  fundingType:
    b.fundingType === 'byudjet' || b.fundingType === 'shartnoma'
      ? b.fundingType
      : null,
  studyPeriod: b.studyPeriod ?? null,
  academicYear: b.academicYear ?? null,
  academicYearRef: b.academicYearRef ?? null,
  courseNumber: b.courseNumber ?? null,
  admissionOrder: b.admissionOrder ?? null,
  admissionDate: b.admissionDate ?? null,
  specialtyId: idOf(b.specialty),
  specialtyTitle: titleOrSnapshot(b.specialty, b.specialtyTitle),
  specialtyCode: codeOrSnapshot(b.specialty, b.specialtyCode),
  departmentId: idOf(b.department),
  departmentTitle: titleOrSnapshot(b.department, b.departmentTitle),
  groupId: idOf(b.group),
  groupTitle: titleOrSnapshot(b.group, b.groupTitle),
  supervisorId: idOf(b.supervisor),
  supervisorName: nameOrSnapshot(nameOf(b.supervisor), b.supervisorName),
  teachingLocation: b.teachingLocation ?? null,
  practiceLocation: b.practiceLocation ?? null,
  scheduleText: b.scheduleText ?? null,
  weeklyHours: typeof b.weeklyHours === 'number' ? b.weeklyHours : null,
  assignedAt: b.assignedAt ?? null,
  diplomaSeria: b.diplomaSeria ?? null,
  diplomaNumber: b.diplomaNumber ?? null,
  diplomaDate: b.diplomaDate ?? null,
  diplomaFileUrl: b.diplomaFileUrl ?? null,
  clinicalSkillsPlan: b.clinicalSkillsPlan ?? [],
  totalUnexcusedHours: b.totalUnexcusedHours ?? 0,
  warningIssued: !!b.warningIssued,
  expulsionOrderCreated: !!b.expulsionOrderCreated,
  active: b.active !== false,
});

export const mapResidentBrief = (b: MaybeRef | BackendResident): ResidentBrief | null => {
  if (!b || typeof b !== 'object') return null;
  const r = b as BackendResident;
  return {
    id: r._id,
    fullName: r.fullName ?? '',
    program: asProgram(r.program ?? 'ordinatura'),
    specialtyTitle: titleOrSnapshot(r.specialty, r.specialtyTitle),
    departmentTitle: titleOrSnapshot(r.department, r.departmentTitle),
    courseNumber: r.courseNumber ?? null,
    groupId: idOf(r.group),
    groupTitle: titleOrSnapshot(r.group, r.groupTitle),
  };
};

export const toResidentPayload = (r: Partial<Resident>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  const copy: (keyof Resident)[] = [
    'program', 'fullName', 'jshshir', 'passportSeria', 'passportNumber',
    'address', 'workplace', 'workplaceLocation', 'email', 'phone', 'foreign', 'fundingType',
    'studyPeriod', 'academicYear', 'courseNumber', 'admissionOrder', 'admissionDate',
    'specialtyTitle', 'specialtyCode', 'departmentTitle', 'groupTitle',
    'diplomaSeria', 'diplomaNumber', 'diplomaDate', 'diplomaFileUrl',
  ];
  for (const k of copy) if (r[k] !== undefined) out[k] = r[k];
  for (const k of ['lastName', 'firstName', 'middleName'] as const) {
    if (r[k]) out[k] = r[k];
  }
  if (r.userId !== undefined) out.user = r.userId || undefined;
  if (r.specialtyId !== undefined) out.specialty = r.specialtyId || undefined;
  if (r.departmentId !== undefined) out.department = r.departmentId || undefined;
  if (r.groupId !== undefined) out.group = r.groupId || undefined;
  return out;
};

export const toAssignPayload = (p: {
  supervisorId: string;
  teachingLocation?: string;
  practiceLocation?: string;
  scheduleText?: string;
  weeklyHours?: number | null;
}): Record<string, unknown> => ({
  supervisor: p.supervisorId,
  teachingLocation: p.teachingLocation ?? '',
  practiceLocation: p.practiceLocation ?? '',
  scheduleText: p.scheduleText ?? '',
  weeklyHours: p.weeklyHours ?? null,
});

export interface BackendAttendance {
  _id: string;
  resident?: MaybeRef | BackendResident;
  date: string;
  science?: MaybeRef;
  scienceTitle?: string | null;
  lessonType?: string | null;
  teacher?: MaybeUser;
  teacherName?: string | null;
  group?: MaybeRef;
  status: string;
  hours?: number;
  score?: number | null;
  samsVerified?: boolean;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  manualVerified?: boolean;
  late?: boolean;
  lateMinutes?: number | null;
  excuseReason?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  application?: RawApplicationRef | string | null;
}
interface RawApplicationRef {
  _id: string;
  fileUrl?: string | null;
  reason?: string | null;
  type?: string | null;
  status?: string | null;
}
const asLessonType = (l?: string | null): Attendance['lessonType'] => {
  const ok: Attendance['lessonType'][] = ['maruza', 'amaliy', 'test', 'oraliq_nazorat', 'yakuniy_nazorat'];
  return l && (ok as string[]).includes(l) ? (l as Attendance['lessonType']) : null;
};
const asAttStatus = (s: string): Attendance['status'] =>
  s === 'absent' ? 'absent' : s === 'excused' ? 'excused' : 'present';

const mapAttendanceApplication = (
  a: RawApplicationRef | string | null | undefined,
): AttendanceApplication | null => {
  if (!a || typeof a === 'string') return null;
  return {
    id: a._id,
    fileUrl: a.fileUrl ?? null,
    reason: a.reason ?? null,
    type: (a.type as AttendanceApplication['type']) ?? null,
    status: (a.status as AttendanceApplication['status']) ?? null,
  };
};

export const mapAttendance = (b: BackendAttendance): Attendance => ({
  id: b._id,
  residentId: idOf(b.resident as MaybeRef) ?? '',
  resident: mapResidentBrief(b.resident as MaybeRef),
  date: b.date,
  scienceId: idOf(b.science),
  scienceTitle: titleOrSnapshot(b.science, b.scienceTitle),
  lessonType: asLessonType(b.lessonType),
  teacherId: idOf(b.teacher),
  teacherName: nameOrSnapshot(nameOf(b.teacher), b.teacherName),
  groupId: idOf(b.group),
  status: asAttStatus(b.status),
  hours: b.hours ?? 2,
  score: b.score ?? null,
  samsVerified: !!b.samsVerified,
  manualVerified: !!b.manualVerified,
  checkInTime: b.checkInTime ?? null,
  checkOutTime: b.checkOutTime ?? null,
  late: !!b.late,
  lateMinutes: typeof b.lateMinutes === 'number' ? b.lateMinutes : null,
  excuseReason: b.excuseReason ?? null,
  fromDate: b.fromDate ?? null,
  toDate: b.toDate ?? null,
  application: mapAttendanceApplication(b.application),
});

export const toAttendancePayload = (a: AttendanceWrite): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  if (a.residentId !== undefined) out.resident = a.residentId;
  if (a.date !== undefined) out.date = a.date;
  if (a.scienceId !== undefined) out.science = a.scienceId || undefined;
  if (a.scienceTitle !== undefined) out.scienceTitle = a.scienceTitle;
  if (a.lessonType !== undefined) out.lessonType = a.lessonType || undefined;
  if (a.teacherId !== undefined) out.teacher = a.teacherId || undefined;
  if (a.teacherName !== undefined) out.teacherName = a.teacherName;
  if (a.groupId !== undefined) out.group = a.groupId || undefined;
  if (a.status !== undefined) out.status = a.status;
  if (a.hours !== undefined) out.hours = a.hours;
  if (a.score !== undefined) out.score = a.score;
  if (a.late !== undefined) out.late = a.late;
  if (a.lateMinutes !== undefined) out.lateMinutes = a.lateMinutes;
  return out;
};

export interface BackendAttendanceStats {
  stats: Array<{ _id: string; count: number; totalHours: number }>;
  summary: BackendResident | null;
}
const ASSESSMENT_TYPES: AssessmentType[] = ['oraliq', 'amaliy', 'yakuniy', 'attestatsiya'];
const asAssessmentType = (v: unknown): AssessmentType | null =>
  ASSESSMENT_TYPES.includes(v as AssessmentType) ? (v as AssessmentType) : null;

export interface BackendAssessment {
  _id: string;
  resident?: MaybeRef | BackendResident;
  science?: MaybeRef;
  type?: string;
  score?: number | null;
  maxScore?: number;
  assessor?: MaybeUser;
  createdAt?: string | null;
}

export const mapAssessment = (b: BackendAssessment): Assessment => ({
  id: b._id,
  residentId: idOf(b.resident as MaybeRef) ?? '',
  resident: mapResidentBrief(b.resident as MaybeRef),
  scienceId: idOf(b.science),
  scienceTitle: titleOf(b.science),
  type: asAssessmentType(b.type),
  score: typeof b.score === 'number' ? b.score : null,
  maxScore: typeof b.maxScore === 'number' ? b.maxScore : 100,
  assessorId: idOf(b.assessor as MaybeRef),
  assessorName: nameOf(b.assessor),
  createdAt: b.createdAt ?? null,
});

export const toGradePayload = (a: {
  residentId: string;
  scienceId?: string | null;
  type: AssessmentType;
  score: number;
  maxScore?: number;
}): Record<string, unknown> => ({
  resident: a.residentId,
  ...(a.scienceId ? { science: a.scienceId } : {}),
  type: a.type,
  score: a.score,
  maxScore: a.maxScore ?? 100,
});

export const mapAttendanceStats = (b: BackendAttendanceStats): AttendanceStats => ({
  stats: (b.stats ?? []).map((s) => ({
    status: asAttStatus(s._id),
    count: s.count,
    totalHours: s.totalHours,
  })),
  summary: b.summary
    ? {
        fullName: b.summary.fullName,
        totalUnexcusedHours: b.summary.totalUnexcusedHours ?? 0,
        warningIssued: !!b.summary.warningIssued,
        expulsionOrderCreated: !!b.summary.expulsionOrderCreated,
      }
    : null,
});

export interface BackendDailyLog {
  _id: string;
  resident?: MaybeRef | BackendResident;
  date: string;
  workType?: string | null;
  semester?: string | null;
  clinicalWork?: string | null;
  skills?: SkillEntry[];
  fileUrl?: string | null;
  status?: string;
  supervisor?: MaybeUser;
  supervisorComment?: string | null;
  comment?: string | null;
}
const asLogStatus = (s?: string): DailyLog['status'] =>
  s === 'tasdiqlangan' ? 'tasdiqlangan' : s === 'qaytarilgan' ? 'qaytarilgan' : 'kutilmoqda';

export const mapDailyLog = (b: BackendDailyLog): DailyLog => ({
  id: b._id,
  residentId: idOf(b.resident as MaybeRef) ?? '',
  resident: mapResidentBrief(b.resident as MaybeRef),
  date: b.date,
  workType: b.workType ?? null,
  semester: b.semester ?? null,
  clinicalWork: b.clinicalWork ?? null,
  skills: b.skills ?? [],
  fileUrl: b.fileUrl ?? null,
  status: asLogStatus(b.status),
  supervisorName: nameOf(b.supervisor),
  supervisorComment: b.supervisorComment ?? null,
  comment: b.comment ?? null,
});

export const toDailyLogPayload = (d: Partial<DailyLog>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  if (d.residentId !== undefined) out.resident = d.residentId;
  if (d.date !== undefined) out.date = d.date;
  if (d.workType !== undefined) out.workType = d.workType;
  if (d.semester !== undefined) out.semester = d.semester;
  if (d.clinicalWork !== undefined) out.clinicalWork = d.clinicalWork;
  if (d.skills !== undefined) out.skills = d.skills;
  if (d.fileUrl !== undefined) out.fileUrl = d.fileUrl;
  if (d.comment !== undefined) out.comment = d.comment;
  return out;
};

export interface BackendApplication {
  _id: string;
  resident?: MaybeRef | BackendResident;
  type: string;
  reason?: string | null;
  academicYear?: string | null;
  academicYearRef?: string | null;
  fileUrl?: string | null;
  status?: string;
  comment?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  reviewedBy?: MaybeUser;
  createdAt?: string | null;
}
const APP_TYPES = ['academic_leave', 'attestation_postpone', 'conference', 'reference', 'schedule_change', 'other'];
const asAppType = (t: string): Application['type'] =>
  (APP_TYPES.includes(t) ? t : 'other') as Application['type'];
const asAppStatus = (s?: string): Application['status'] => {
  const ok = ['yangi', 'korib_chiqilmoqda', 'tasdiqlangan', 'rad_etilgan'];
  return (s && ok.includes(s) ? s : 'yangi') as Application['status'];
};

export const mapApplication = (b: BackendApplication): Application => ({
  id: b._id,
  residentId: idOf(b.resident as MaybeRef) ?? '',
  resident: mapResidentBrief(b.resident as MaybeRef),
  type: asAppType(b.type),
  reason: b.reason ?? null,
  academicYear: b.academicYear ?? null,
  academicYearRef: b.academicYearRef ?? null,
  fileUrl: b.fileUrl ?? null,
  status: asAppStatus(b.status),
  comment: b.comment ?? null,
  fromDate: b.fromDate ?? null,
  toDate: b.toDate ?? null,
  reviewedByName: nameOf(b.reviewedBy),
  createdAt: b.createdAt ?? null,
});

export const toApplicationPayload = (a: {
  residentId?: string;
  type: Application['type'];
  reason: string;
  academicYear?: string;
  academicYearRef?: string | null;
  fileUrl?: string;
}): Record<string, unknown> => ({
  ...(a.residentId ? { resident: a.residentId } : {}),
  type: a.type,
  reason: a.reason,
  ...(a.academicYear ? { academicYear: a.academicYear } : {}),
  ...(a.fileUrl ? { fileUrl: a.fileUrl } : {}),
});

export const toReviewPayload = (p: {
  status: 'korib_chiqilmoqda' | 'tasdiqlangan' | 'rad_etilgan';
  comment?: string;
  fromDate?: string;
  toDate?: string;
}): Record<string, unknown> => ({
  status: p.status,
  ...(p.comment !== undefined ? { comment: p.comment } : {}),
  ...(p.fromDate ? { fromDate: p.fromDate } : {}),
  ...(p.toDate ? { toDate: p.toDate } : {}),
});

export const mapUserOption = (u: RawUser): UserOption => ({
  id: u._id,
  name: nameOf(u) ?? u._id,
  roleTitle: u.role?.title ?? u.role?.name ?? '',
  departmentId: idOf(u.department),
});
export const mapRefOption = (r: RawRef): RefOption => ({
  id: r._id,
  title: r.title ?? r.name ?? '',
});

export interface BackendJournalStats {
  present?: number;
  absent?: number;
  excused?: number;
  late?: number;
  total?: number;
  percent?: number;
}
export const mapJournalStats = (b: BackendJournalStats): JournalStats => ({
  present: b.present ?? 0,
  absent: b.absent ?? 0,
  excused: b.excused ?? 0,
  late: b.late ?? 0,
  total: b.total ?? 0,
  percent: b.percent ?? 0,
});

export interface BackendResidentRollup {
  _id?: string;
  resident?: {
    _id?: string;
    fullName?: string | null;
    specialtyTitle?: string | null;
    courseNumber?: number | null;
  } | null;
  total?: number;
  present?: number;
  absent?: number;
  excused?: number;
  late?: number;
  scoreSum?: number;
  scoreAvg?: number | null;
  scoredCount?: number;
  lastDate?: string;
}
const finiteOrNull = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;
export const mapResidentRollup = (b: BackendResidentRollup): ResidentRollup => ({
  residentId: String(b._id ?? b.resident?._id ?? ''),
  resident: b.resident
    ? {
        fullName: b.resident.fullName ?? null,
        specialtyTitle: b.resident.specialtyTitle ?? null,
        courseNumber: b.resident.courseNumber ?? null,
      }
    : null,
  total: b.total ?? 0,
  present: b.present ?? 0,
  absent: b.absent ?? 0,
  excused: b.excused ?? 0,
  late: b.late ?? 0,
  scoreSum: b.scoreSum ?? 0,
  scoreAvg: finiteOrNull(b.scoreAvg),
  scoredCount: finiteOrNull(b.scoredCount) ?? 0,
  lastDate: b.lastDate ?? '',
});
