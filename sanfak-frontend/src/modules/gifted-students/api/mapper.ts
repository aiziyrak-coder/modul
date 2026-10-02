import type { Criterion, StudentRecord, Activity, DocumentType, Scholarship, ScholarshipCriterion, ScholarshipApplication, Message } from '../data/types';
import { canonicalAcademicYear, currentAcademicYear } from '../lib/academic-years';
import { nameOf, type MaybeUserName } from './user-name';

type Ref<T> = string | (T & { _id: string }) | null | undefined;
const refId = (r: Ref<object>): string => (typeof r === 'object' && r ? r._id : (r ?? '')) as string;

export interface BackendCriterion {
  _id: string;
  name: string;
  icon?: string;
  maxPoints?: number | null;
  categories?: Array<{ _id?: string; name: string; points?: number; active?: boolean }>;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export function mapCriterion(b: BackendCriterion): Criterion {
  return {
    id: b._id,
    name: b.name,
    icon: b.icon || '📄',
    active: b.active !== false,
    ...(b.maxPoints != null ? { ball: b.maxPoints } : {}),
    categories: (b.categories ?? []).map((c) => ({
      id: c._id ?? '',
      name: c.name,
      points: c.points ?? 0,
      active: c.active !== false,
    })),
  };
}

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

export function toCriterionPayload(c: Partial<Criterion>): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: c.name,
    icon: c.icon,
    active: c.active,
    categories: (c.categories ?? []).map((cat) => ({
      ...(OBJECT_ID.test(cat.id ?? '') ? { _id: cat.id } : {}),
      name: cat.name,
      points: cat.points,
      active: cat.active,
    })),
  };
  if (c.ball != null) payload.maxPoints = c.ball;
  return payload;
}

export interface BackendStudent {
  _id: string;
  user?: string | null;
  fullName: string;
  passportSeria?: string | null;
  passportNumber?: string | null;
  jshshir?: string | null;
  faculty?: string | null;
  direction?: string | null;
  course?: number | null;
  group?: string | null;
  facultyId?: Ref<object>;
  directionId?: Ref<object>;
  groupId?: Ref<object>;
  academicYear?: string | null;
  advisorId?: string | null;
  advisorName?: string | null;
  advisor?: unknown;
  email?: string | null;
  phone?: string | null;
  workplace?: string | null;
  totalScore?: number;
  scoresByYear?: Record<string, number>;
  rank?: number;
  active?: boolean;
  createdAt?: string;
}

export function mapStudent(b: BackendStudent): StudentRecord {
  return {
    id: b._id,
    userId: refId(b.user) || undefined,
    name: b.fullName,
    passport: { series: b.passportSeria ?? '', number: b.passportNumber ?? '' },
    jshshir: b.jshshir ?? '',
    email: b.email ?? '',
    phone: b.phone ?? '',
    workplace: b.workplace ?? '',
    faculty: b.faculty ?? '',
    direction: b.direction ?? '',
    course: b.course ?? 0,
    group: b.group ?? '',
    academicYear: canonicalAcademicYear(b.academicYear),
    advisorId: b.advisorId ?? '',
    advisorName: nameOf(b.advisor as MaybeUserName) ?? b.advisorName ?? '',
    facultyId: refId(b.facultyId) || undefined,
    directionId: refId(b.directionId) || undefined,
    groupId: refId(b.groupId) || undefined,
    totalScore: b.totalScore ?? 0,
    scoresByYear: b.scoresByYear ?? {},
    yearScore: b.scoresByYear?.[currentAcademicYear()] ?? 0,
    rank: b.rank ?? 0,
  };
}

export function toStudentPayload(s: Partial<StudentRecord>): Record<string, unknown> {
  return {
    user: s.userId || null,
    fullName: s.name,
    ...(s.lastName ? { lastName: s.lastName } : {}),
    ...(s.firstName ? { firstName: s.firstName } : {}),
    ...(s.middleName ? { middleName: s.middleName } : {}),
    passportSeria: s.passport?.series,
    passportNumber: s.passport?.number,
    jshshir: s.jshshir,
    faculty: s.faculty,
    direction: s.direction,
    course: s.course,
    group: s.group,
    academicYear: s.academicYear,
    advisorId: s.advisorId || null,
    advisorName: s.advisorName,
    ...(s.facultyId ? { facultyId: s.facultyId } : {}),
    ...(s.directionId ? { directionId: s.directionId } : {}),
    ...(s.groupId ? { groupId: s.groupId } : {}),
    email: s.email,
    phone: s.phone,
    workplace: s.workplace,
  };
}

export interface BackendAdvisor {
  fullName: string;
  degree?: string | null;
  department?: string | null;
  email?: string | null;
  phone?: string | null;
  photo?: string | null;
  publications?: number | null;
  hIndex?: number | null;
  workingHours?: string | null;
  office?: string | null;
}

export interface AdvisorDetail {
  fullName: string;
  degree?: string;
  department?: string;
  email?: string;
  phone?: string;
  photo?: string;
  publications?: number;
  hIndex?: number;
  workingHours?: string;
  office?: string;
}

export function mapAdvisor(b: BackendAdvisor): AdvisorDetail {
  return {
    fullName: b.fullName,
    ...(b.degree ? { degree: b.degree } : {}),
    ...(b.department ? { department: b.department } : {}),
    ...(b.email ? { email: b.email } : {}),
    ...(b.phone ? { phone: b.phone } : {}),
    ...(b.photo ? { photo: b.photo } : {}),
    ...(b.publications != null ? { publications: b.publications } : {}),
    ...(b.hIndex != null ? { hIndex: b.hIndex } : {}),
    ...(b.workingHours ? { workingHours: b.workingHours } : {}),
    ...(b.office ? { office: b.office } : {}),
  };
}

export interface BackendDocType {
  _id: string;
  title: string;
  desc?: string | null;
  active?: boolean;
  personal?: boolean;
}

export function mapDocType(b: BackendDocType): DocumentType {
  return { id: b._id, title: b.title, description: b.desc ?? '', active: b.active !== false, personal: !!b.personal };
}

export function toDocTypePayload(d: Partial<DocumentType>): Record<string, unknown> {
  return { title: d.title, desc: d.description, active: d.active, personal: d.personal };
}

export interface BackendAchievement {
  _id: string;
  student?: Ref<{ fullName: string; faculty: string; direction: string; course: number; group: string }>;
  documentType?: Ref<{ title: string; desc?: string | null; personal: boolean }>;
  title?: string;
  desc?: string | null;
  fileUrl?: string;
  fileName?: string;
  link?: string;
  score?: number;
  status?: string;
  reviewNote?: string;
  reviewedAt?: string | null;
  reviewHistory?: Array<{
    status?: string;
    note?: string | null;
    reviewedAt?: string | null;
    supersededAt?: string | null;
  }>;
  createdAt?: string;
}

export function mapAchievement(b: BackendAchievement): Activity {
  const stu = typeof b.student === 'object' && b.student ? b.student : null;
  const dt = typeof b.documentType === 'object' && b.documentType ? b.documentType : null;
  return {
    id: b._id,
    studentId: refId(b.student),
    studentName: stu?.fullName ?? '',
    faculty: stu?.faculty ?? '',
    direction: stu?.direction ?? '',
    course: stu?.course ?? 0,
    criteriaId: refId(b.documentType),
    criteriaName: dt?.title ?? '',
    criteriaDesc: dt?.desc ?? '',
    categoryId: '',
    categoryName: '',
    title: b.title ?? '',
    description: b.desc ?? '',
    note: b.desc ?? '',
    status: b.status ?? 'pending',
    points: b.score ?? 0,
    submittedAt: (b.createdAt ?? '').split('T')[0] ?? '',
    reviewedAt: b.reviewedAt ?? null,
    reviewNote: b.reviewNote ?? '',
    reviewHistory: (b.reviewHistory ?? []).map((h) => ({
      status: h.status ?? '',
      note: h.note ?? '',
      reviewedAt: h.reviewedAt ?? null,
      supersededAt: h.supersededAt ?? null,
    })),
    fileUrl: b.fileUrl ?? '',
    fileName: b.fileName ?? '',
    link: b.link ?? '',
  };
}

export interface AchievementFormInput extends Partial<Activity> {
  file?: File | null;
}

export function toAchievementForm(a: AchievementFormInput): Record<string, string | File | undefined> {
  return {
    documentType: a.criteriaId,
    title: a.title,
    desc: a.description ?? a.note,
    link: a.link,
    file: a.file ?? undefined,
  };
}

interface BackendScholarshipCriterion {
  criteria?: Ref<{ name: string }>;
  categoryIds?: string[];
  pointOverrides?: Array<{ categoryId: string; points: number }>;
  typePointOverride?: number;
}

export interface BackendScholarship {
  _id: string;
  name: string;
  description?: string | null;
  type: 'nomdor' | 'rektor';
  minScore?: number;
  amount?: string | null;
  deadline?: string | null;
  academicYear?: string | null;
  allowedCourses?: string[];
  active?: boolean;
  judges?: Array<Ref<{ firstName?: string; lastName?: string }>>;
  criteria?: BackendScholarshipCriterion[];
  scoringComplete?: boolean;
  canApply?: boolean;
  canApplyReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export function mapScholarship(b: BackendScholarship): Scholarship {
  return {
    id: b._id,
    name: b.name,
    description: b.description ?? '',
    type: b.type,
    minScore: b.minScore ?? 0,
    amount: b.amount ?? '',
    deadline: (b.deadline ?? '').split('T')[0] ?? '',
    academicYear: canonicalAcademicYear(b.academicYear),
    active: b.active !== false,
    allowedCourses: b.allowedCourses ?? [],
    judges: (b.judges ?? []).map(refId).filter(Boolean),
    criteria: (b.criteria ?? []).map((c) => {
      const entry: ScholarshipCriterion = {
        criteriaId: refId(c.criteria),
        categoryIds: c.categoryIds ?? [],
      };
      const overrides = Object.fromEntries((c.pointOverrides ?? []).map((o) => [o.categoryId, o.points]));
      if (Object.keys(overrides).length > 0) entry.pointOverrides = overrides;
      if (c.typePointOverride != null) entry.typePointOverride = c.typePointOverride;
      return entry;
    }),
    ...(b.scoringComplete != null ? { scoringComplete: b.scoringComplete } : {}),
    ...(b.canApply != null
      ? { canApply: b.canApply, canApplyReason: b.canApplyReason ?? null }
      : {}),
  };
}

export function toScholarshipPayload(s: Partial<Scholarship>): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (s.name !== undefined) p.name = s.name;
  if (s.description !== undefined) p.description = s.description;
  if (s.minScore !== undefined) p.minScore = s.minScore;
  if (s.amount !== undefined) p.amount = s.amount;
  if (s.deadline !== undefined) p.deadline = s.deadline || undefined;
  if (s.academicYear !== undefined) p.academicYear = s.academicYear;
  if (s.allowedCourses !== undefined) p.allowedCourses = s.allowedCourses;
  if (s.active !== undefined) p.active = s.active;
  if (s.type && s.type !== 'general') p.type = s.type;
  if (s.judges !== undefined) p.judges = s.judges;
  if (s.criteria !== undefined) {
    p.criteria = s.criteria.map((c) => {
      const be: Record<string, unknown> = { criteria: c.criteriaId, categoryIds: c.categoryIds ?? [] };
      if (c.pointOverrides && Object.keys(c.pointOverrides).length > 0) {
        be.pointOverrides = Object.entries(c.pointOverrides).map(([categoryId, points]) => ({ categoryId, points }));
      }
      if (c.typePointOverride != null) be.typePointOverride = c.typePointOverride;
      return be;
    });
  }
  return p;
}

export interface BackendApplication {
  _id: string;
  giftedStudent?: Ref<{ fullName?: string; faculty?: string; direction?: string; course?: number; group?: string }>;
  scholarship?: Ref<{ name?: string; type?: string }>;
  type?: string;
  scholarshipName?: string;
  appliedAt?: string;
  status?: string;
  reviewedAt?: string | null;
  rejectReason?: string;
  amount?: number;
  period?: string;
  academicYear?: string;
  createdAt?: string;
  judgeScores?: Array<{
    judge?: Ref<object>;
    scores?: Array<{ criteria?: Ref<object>; categoryId?: string; value?: number }>;
    totalScore?: number;
  }>;
}

const scoreColKey = (criteria: Ref<object>, categoryId?: string): string => {
  const cid = refId(criteria);
  return categoryId ? `${cid}_${categoryId}` : cid;
};

export function mapApplication(b: BackendApplication): ScholarshipApplication {
  const sch = typeof b.scholarship === 'object' && b.scholarship ? b.scholarship : null;
  const stu = typeof b.giftedStudent === 'object' && b.giftedStudent ? b.giftedStudent : null;

  const judgeScores: Record<string, Record<string, number>> = {};
  for (const j of b.judgeScores ?? []) {
    const jid = refId(j.judge);
    if (!jid) continue;
    const m: Record<string, number> = {};
    for (const sc of j.scores ?? []) {
      if (sc.value != null) m[scoreColKey(sc.criteria, sc.categoryId)] = sc.value;
    }
    judgeScores[jid] = m;
  }

  return {
    id: b._id,
    studentId: refId(b.giftedStudent),
    studentName: stu?.fullName ?? '',
    faculty: stu?.faculty ?? '',
    direction: stu?.direction ?? '',
    course: stu?.course ?? 0,
    group: stu?.group ?? '',
    scholarshipId: refId(b.scholarship),
    scholarshipName: sch?.name || b.scholarshipName || '',
    status: b.status === 'approved' ? 'recommended' : (b.status ?? 'pending'),
    appliedAt: ((b.appliedAt ?? b.createdAt) ?? '').split('T')[0] ?? '',
    reviewedAt: b.reviewedAt ? (b.reviewedAt.split('T')[0] ?? null) : null,
    academicYear: canonicalAcademicYear(b.academicYear),
    note: b.rejectReason ?? '',
    judgeScores,
  };
}

export function toScorePayload(scores: Record<string, number>): Array<Record<string, unknown>> {
  return Object.entries(scores).map(([colKey, value]) => {
    const i = colKey.indexOf('_');
    return i === -1
      ? { criteria: colKey, value }
      : { criteria: colKey.slice(0, i), categoryId: colKey.slice(i + 1), value };
  });
}

export interface ApplyInput {
  scholarshipId: string;
  scholarshipType: 'general' | 'nomdor' | 'rektor';
  scholarshipName: string;
  academicYear?: string;
  motivation?: string;
}

export function toApplyPayload(a: ApplyInput): Record<string, unknown> {
  return {
    scholarship: a.scholarshipId,
    type: a.scholarshipType === 'rektor' ? 'rektor_stipendiyasi' : 'nomdor_stipendiya',
    scholarshipName: a.scholarshipName,
    academicYear: canonicalAcademicYear(a.academicYear),
    motivation: a.motivation,
  };
}

export interface BackendChatMessage {
  _id: string;
  sender?: Ref<{ firstName?: string; lastName?: string; photo?: string }>;
  receiver?: Ref<object>;
  message?: string;
  fileUrl?: string;
  fileType?: string;
  readAt?: string | null;
  createdAt?: string;
}

export function mapChatMessage(b: BackendChatMessage): Message {
  return {
    id: b._id,
    senderId: refId(b.sender),
    text: b.message ?? '',
    timestamp: b.createdAt ?? '',
    read: !!b.readAt,
    type: b.fileType ? 'file' : 'text',
    fileUrl: b.fileUrl ?? null,
    fileName: b.fileUrl ? b.fileUrl.split('/').pop() || null : null,
  };
}
