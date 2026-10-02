import type {
  DegreesByType,
  EducationTabKey,
  ProfileFormValues,
  TeacherProfile,
} from '../model/types';
import { EDUCATION_TABS, EMPTY_DEGREES } from '../model/types';

interface BackendDegreeDocument {
  _id: string;
  title: string;
  path: string;
}

interface BackendUser {
  _id: string;
  firstName?: string | null;
  lastName?: string | null;
  middleName?: string | null;
  photo?: string | null;
  phone?: string | null;
  email?: string | null;
  degrees?: Partial<Record<EducationTabKey, BackendDegreeDocument[]>> | null;
}

interface BackendRef {
  _id: string;
  title?: string | null;
}

interface BackendHrApprover {
  _id: string;
  firstName?: string | null;
  lastName?: string | null;
}

export interface BackendTeacherProfile {
  _id: string;
  user?: BackendUser | string | null;
  department?: BackendRef | string | null;
  faculty?: BackendRef | string | null;
  position?: BackendRef | string | null;
  photo?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  passportSeries?: string | null;
  passportNumber?: string | null;
  jshshir?: string | null;
  address?: { region?: string | null; district?: string | null; street?: string | null } | null;
  contactInfo?: { phone?: string | null; email?: string | null } | null;
  googleScholarUrl?: string | null;
  scopusUrl?: string | null;
  hrApprovalStatus?: string | null;
  hrApprovedBy?: BackendHrApprover | string | null;
  hrApprovalDate?: string | null;
  hrComment?: string | null;
}

export type BackendDegrees = Partial<Record<EducationTabKey, BackendDegreeDocument[]>>;

function extractRefId(ref: BackendRef | string | null | undefined): string | null {
  if (!ref) return null;
  return typeof ref === 'string' ? ref : ref._id;
}

function extractRefTitle(ref: BackendRef | string | null | undefined): string | null {
  if (!ref || typeof ref === 'string') return null;
  return ref.title ?? null;
}

function extractUser(user: BackendUser | string | null | undefined): BackendUser | null {
  if (!user || typeof user === 'string') return null;
  return user;
}

function extractApproverName(approver: BackendHrApprover | string | null | undefined): string | null {
  if (!approver || typeof approver === 'string') return null;
  return [approver.lastName, approver.firstName].filter(Boolean).join(' ') || null;
}

export function mapDegrees(raw: BackendDegrees | null | undefined): DegreesByType {
  const result = { ...EMPTY_DEGREES };
  EDUCATION_TABS.forEach((type) => {
    const docs = raw?.[type] ?? [];
    result[type] = docs.map((d) => ({ id: d._id, title: d.title, path: d.path }));
  });
  return result;
}

export function mapTeacherProfile(b: BackendTeacherProfile): TeacherProfile {
  const user = extractUser(b.user);
  return {
    id: b._id,
    userId: typeof b.user === 'string' ? b.user : (b.user?._id ?? null),
    fullName: user ? [user.lastName, user.firstName, user.middleName].filter(Boolean).join(' ') || null : null,
    firstName: user?.firstName ?? null,
    lastName: user?.lastName ?? null,
    middleName: user?.middleName ?? null,
    photo: b.photo ?? user?.photo ?? null,

    departmentId: extractRefId(b.department),
    departmentTitle: extractRefTitle(b.department),
    facultyId: extractRefId(b.faculty),
    facultyTitle: extractRefTitle(b.faculty),
    positionId: extractRefId(b.position),
    positionTitle: extractRefTitle(b.position),

    birthDate: b.birthDate ?? null,
    gender: (b.gender as TeacherProfile['gender']) ?? null,
    passportSeries: b.passportSeries ?? null,
    passportNumber: b.passportNumber ?? null,
    jshshir: b.jshshir ?? null,
    addressRegion: b.address?.region ?? null,
    addressDistrict: b.address?.district ?? null,
    addressStreet: b.address?.street ?? null,

    phone: b.contactInfo?.phone ?? user?.phone ?? null,
    email: b.contactInfo?.email ?? user?.email ?? null,

    googleScholarUrl: b.googleScholarUrl ?? null,
    scopusUrl: b.scopusUrl ?? null,

    degrees: mapDegrees(user?.degrees),

    hrApprovalStatus: (b.hrApprovalStatus as TeacherProfile['hrApprovalStatus']) ?? 'pending',
    hrApprovedByName: extractApproverName(b.hrApprovedBy),
    hrApprovalDate: b.hrApprovalDate ?? null,
    hrComment: b.hrComment ?? null,
  };
}

export function toFormValues(p: TeacherProfile | null): ProfileFormValues {
  return {
    faculty: p?.facultyId ?? null,
    department: p?.departmentId ?? null,
    position: p?.positionId ?? null,
    phone: p?.phone ?? null,
    email: p?.email ?? null,
    googleScholarUrl: p?.googleScholarUrl ?? null,
    scopusUrl: p?.scopusUrl ?? null,
  };
}

function nullIfEmpty(v: string | null | undefined): string | null {
  return v && v.trim().length > 0 ? v : null;
}

export function toUpdatePayload(values: ProfileFormValues): Record<string, unknown> {
  return {
    faculty: values.faculty || undefined,
    department: values.department || undefined,
    position: values.position || undefined,
    contactInfo: {
      phone: nullIfEmpty(values.phone),
      email: nullIfEmpty(values.email),
    },
    googleScholarUrl: nullIfEmpty(values.googleScholarUrl),
    scopusUrl: nullIfEmpty(values.scopusUrl),
  };
}

export function toCreatePayload(values: ProfileFormValues): Record<string, unknown> {
  return { ...toUpdatePayload(values) };
}
