import type { AdminUser } from '../model/types';

export interface BackendUser {
  _id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  email?: string;
  phone?: string;
  photo?: string;
  oneIdPin?: string;
  passportSeria?: string;
  passportNumber?: string | number;
  role?: { _id: string; title: string } | string;
  position?: { _id: string; title: string } | string;
  division?: { _id: string; title: string } | string;
  department?: { _id: string; title: string } | string;
  faculty?: { _id: string; title: string } | string;
  academicTitle?: { _id: string; title: string } | string;
  publications?: number | null;
  hIndex?: number | null;
  workingHours?: string | null;
  office?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export function mapUser(b: BackendUser): AdminUser {
  return {
    id: b._id,
    firstName: b.firstName,
    lastName: b.lastName,
    middleName: b.middleName,
    email: b.email,
    phone: b.phone,
    photo: b.photo,
    oneIdPin: b.oneIdPin,
    passportSeria: b.passportSeria,
    passportNumber:
      b.passportNumber == null ? undefined : String(b.passportNumber),
    role:
      typeof b.role === 'object' && b.role
        ? { id: b.role._id, title: b.role.title }
        : undefined,
    position:
      typeof b.position === 'object' && b.position
        ? { id: b.position._id, title: b.position.title }
        : b.position,
    division:
      typeof b.division === 'object' && b.division
        ? { id: b.division._id, title: b.division.title }
        : b.division,
    department:
      typeof b.department === 'object' && b.department
        ? { id: b.department._id, title: b.department.title }
        : b.department,
    faculty:
      typeof b.faculty === 'object' && b.faculty
        ? { id: b.faculty._id, title: b.faculty.title }
        : b.faculty,
    academicTitle:
      typeof b.academicTitle === 'object' && b.academicTitle
        ? { id: b.academicTitle._id, title: b.academicTitle.title }
        : b.academicTitle,
    publications: b.publications ?? undefined,
    hIndex: b.hIndex ?? undefined,
    workingHours: b.workingHours ?? undefined,
    office: b.office ?? undefined,
    active: b.active,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}
