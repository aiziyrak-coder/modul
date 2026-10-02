import {
  emptyStaffFormValues,
  type StaffDegreeDocument,
  type StaffDetail,
  type StaffFormValues,
  type StaffListItem,
} from '../model/staff-types';
import { TEACHING_SPECIALTY_BASIS_VALUES, type TeachingSpecialtyBasis } from '../model/specialty-catalog';

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

interface BackendFacultyRef {
  _id: string;
  title?: string | null;
}

interface BackendDepartmentRef {
  _id: string;
  title?: string | null;
  faculty?: BackendFacultyRef | string | null;
}

interface BackendRef {
  _id: string;
  title?: string | null;
}

export interface BackendStaffUser {
  _id: string;
  firstName?: string | null;
  lastName?: string | null;
  middleName?: string | null;
  email?: string | null;
  phone?: string | null;
  photo?: string | null;
  department?: BackendDepartmentRef | string | null;
  position?: BackendRef | string | null;
  academicTitle?: BackendRef | string | null;
  jshshir?: string | null;
  passportSeria?: string | null;
  passportNumber?: number | string | null;
  googleScholar?: string | null;
  scopus?: string | null;
  active?: boolean | null;
  createdAt?: string | null;
  degrees?: BackendUserDegrees | null;
  teachingSpecialtyName?: string | null;
  teachingSpecialtyCode?: string | null;
  teachingSpecialtyBasis?: string | null;
  teachingSpecialtyNote?: string | null;
}

function toTeachingSpecialtyBasis(raw: string | null | undefined): TeachingSpecialtyBasis | null {
  if (!raw) return null;
  return (TEACHING_SPECIALTY_BASIS_VALUES as readonly string[]).includes(raw)
    ? (raw as TeachingSpecialtyBasis)
    : null;
}

function extractRef(ref: BackendRef | string | null | undefined): BackendRef | null {
  if (!ref || typeof ref === 'string') return null;
  return ref;
}

function extractDepartment(
  ref: BackendDepartmentRef | string | null | undefined,
): BackendDepartmentRef | null {
  if (!ref || typeof ref === 'string') return null;
  return ref;
}

function extractFacultyTitle(dept: BackendDepartmentRef | null): string | null {
  const faculty = dept?.faculty;
  if (!faculty || typeof faculty === 'string') return null;
  return faculty.title ?? null;
}

function mapDegreeList(list: BackendDegreeDocument[] | null | undefined): StaffDegreeDocument[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((d) => d && d.title && d.path)
    .map((d) => ({ title: d.title as string, path: d.path as string }));
}

function buildFullName(u: BackendStaffUser): string {
  return [u.lastName, u.firstName, u.middleName].filter(Boolean).join(' ');
}

export function mapStaffListItem(u: BackendStaffUser): StaffListItem {
  const department = extractDepartment(u.department);
  const position = extractRef(u.position);
  return {
    id: u._id,
    fullName: buildFullName(u),
    email: u.email ?? null,
    photo: u.photo ?? null,
    positionTitle: position?.title ?? null,
    departmentTitle: department?.title ?? null,
    facultyTitle: extractFacultyTitle(department),
    phone: u.phone ?? null,
    createdAt: u.createdAt ?? null,
  };
}

export function mapStaffDetail(u: BackendStaffUser): StaffDetail {
  const department = extractDepartment(u.department);
  const position = extractRef(u.position);
  const academicTitle = extractRef(u.academicTitle);
  const degrees = u.degrees ?? null;
  return {
    id: u._id,
    photo: u.photo ?? null,
    firstName: u.firstName ?? null,
    lastName: u.lastName ?? null,
    middleName: u.middleName ?? null,
    email: u.email ?? null,
    phone: u.phone ?? null,
    jshshir: u.jshshir ?? null,
    passportSeries: u.passportSeria ?? null,
    passportNumber: u.passportNumber != null ? String(u.passportNumber) : null,
    department: department?._id ?? (typeof u.department === 'string' ? u.department : null),
    departmentTitle: department?.title ?? null,
    faculty:
      department?.faculty && typeof department.faculty !== 'string'
        ? (department.faculty._id ?? null)
        : null,
    facultyTitle: extractFacultyTitle(department),
    position: position?._id ?? (typeof u.position === 'string' ? u.position : null),
    positionTitle: position?.title ?? null,
    academicTitle:
      academicTitle?._id ?? (typeof u.academicTitle === 'string' ? u.academicTitle : null),
    academicTitleTitle: academicTitle?.title ?? null,
    googleScholarUrl: u.googleScholar ?? null,
    scopusUrl: u.scopus ?? null,
    bachelorDegree: mapDegreeList(degrees?.bachelorDegree),
    masterDegree: mapDegreeList(degrees?.masterDegree),
    scientificDegree: mapDegreeList(degrees?.scientificDegree),
    scientificTitle: mapDegreeList(degrees?.scientificTitle),
    teachingSpecialtyName: u.teachingSpecialtyName ?? null,
    teachingSpecialtyCode: u.teachingSpecialtyCode ?? null,
    teachingSpecialtyBasis: toTeachingSpecialtyBasis(u.teachingSpecialtyBasis),
    teachingSpecialtyNote: u.teachingSpecialtyNote ?? null,
  };
}

export function toStaffFormValues(detail: StaffDetail | null): StaffFormValues {
  if (!detail) return { ...emptyStaffFormValues };
  return {
    photo: null,
    existingPhotoUrl: detail.photo,
    firstName: detail.firstName ?? '',
    lastName: detail.lastName ?? '',
    middleName: detail.middleName ?? '',
    phone: detail.phone ?? '',
    jshshir: detail.jshshir ?? '',
    passportSeries: detail.passportSeries ?? '',
    passportNumber: detail.passportNumber ?? '',
    email: detail.email ?? '',
    faculty: detail.faculty,
    department: detail.department,
    position: detail.position,
    academicTitle: detail.academicTitle,
    googleScholarUrl: detail.googleScholarUrl ?? '',
    scopusUrl: detail.scopusUrl ?? '',
    bachelorDegree: detail.bachelorDegree,
    bachelorDegreeNew: [],
    masterDegree: detail.masterDegree,
    masterDegreeNew: [],
    scientificDegree: detail.scientificDegree,
    scientificDegreeNew: [],
    scientificTitle: detail.scientificTitle,
    scientificTitleNew: [],
    teachingSpecialtyName: detail.teachingSpecialtyName ?? '',
    teachingSpecialtyCode: detail.teachingSpecialtyCode ?? '',
    teachingSpecialtyBasis: detail.teachingSpecialtyBasis,
    teachingSpecialtyNote: detail.teachingSpecialtyNote ?? '',
  };
}
