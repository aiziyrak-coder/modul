import type { DegreeDocument, HrProfileDetail, HrProfileListItem } from '../model/types';

interface BackendDegreeDocument {
  title?: string | null;
  path?: string | null;
}

interface BackendUserDegrees {
  bachelorDegree?: BackendDegreeDocument[];
  masterDegree?: BackendDegreeDocument[];
  scientificDegree?: BackendDegreeDocument[];
  scientificTitle?: BackendDegreeDocument[];
}

interface BackendUser {
  _id: string;
  firstName?: string | null;
  lastName?: string | null;
  middleName?: string | null;
  photo?: string | null;
  phone?: string | null;
  email?: string | null;
  degrees?: BackendUserDegrees | null;
}

interface BackendRef {
  _id: string;
  title?: string | null;
}

export interface BackendHrProfile {
  _id: string;
  user?: BackendUser | string | null;
  department?: BackendRef | string | null;
  faculty?: BackendRef | string | null;
  position?: BackendRef | string | null;
  contactInfo?: { phone?: string | null; email?: string | null } | null;
  jshshir?: string | null;
  passportSeries?: string | null;
  passportNumber?: string | null;
  birthDate?: string | null;
  address?: { region?: string | null; district?: string | null; street?: string | null } | null;
  googleScholarUrl?: string | null;
  scopusUrl?: string | null;
  hrApprovalStatus?: string | null;
  hrComment?: string | null;
  changedFields?: string[] | null;
  updatedAt?: string | null;
}

function extractUser(user: BackendUser | string | null | undefined): BackendUser | null {
  if (!user || typeof user === 'string') return null;
  return user;
}

function extractRefTitle(ref: BackendRef | string | null | undefined): string | null {
  if (!ref || typeof ref === 'string') return null;
  return ref.title ?? null;
}

function mapDegreeList(list: BackendDegreeDocument[] | null | undefined): DegreeDocument[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((d) => d && d.title && d.path)
    .map((d) => ({ title: d.title as string, path: d.path as string }));
}

function buildFullName(user: BackendUser | null): string {
  if (!user) return '';
  return [user.lastName, user.firstName, user.middleName].filter(Boolean).join(' ');
}

export function mapHrProfileListItem(b: BackendHrProfile): HrProfileListItem {
  const user = extractUser(b.user);
  return {
    id: b._id,
    fullName: buildFullName(user),
    positionTitle: extractRefTitle(b.position),
    departmentTitle: extractRefTitle(b.department),
    phone: b.contactInfo?.phone ?? user?.phone ?? null,
    submittedAt: b.updatedAt ?? null,
    hrApprovalStatus: (b.hrApprovalStatus as HrProfileListItem['hrApprovalStatus']) ?? 'pending',
    hrComment: b.hrComment ?? null,
  };
}

export function mapHrProfileDetail(b: BackendHrProfile): HrProfileDetail {
  const user = extractUser(b.user);
  const degrees = user?.degrees ?? null;
  return {
    id: b._id,
    photo: user?.photo ?? null,

    firstName: user?.firstName ?? null,
    lastName: user?.lastName ?? null,
    middleName: user?.middleName ?? null,
    phone: b.contactInfo?.phone ?? user?.phone ?? null,
    email: b.contactInfo?.email ?? user?.email ?? null,

    jshshir: b.jshshir ?? null,
    passportSeries: b.passportSeries ?? null,
    passportNumber: b.passportNumber ?? null,
    birthDate: b.birthDate ?? null,

    addressRegion: b.address?.region ?? null,
    addressDistrict: b.address?.district ?? null,
    addressStreet: b.address?.street ?? null,

    facultyTitle: extractRefTitle(b.faculty),
    departmentTitle: extractRefTitle(b.department),
    positionTitle: extractRefTitle(b.position),

    googleScholarUrl: b.googleScholarUrl ?? null,
    scopusUrl: b.scopusUrl ?? null,

    bachelorDegree: mapDegreeList(degrees?.bachelorDegree),
    masterDegree: mapDegreeList(degrees?.masterDegree),
    scientificDegree: mapDegreeList(degrees?.scientificDegree),
    scientificTitle: mapDegreeList(degrees?.scientificTitle),

    hrApprovalStatus: (b.hrApprovalStatus as HrProfileDetail['hrApprovalStatus']) ?? 'pending',
    hrComment: b.hrComment ?? null,
    changedFields: Array.isArray(b.changedFields) ? b.changedFields : [],
  };
}
