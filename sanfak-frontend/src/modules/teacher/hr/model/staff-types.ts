import type { TeachingSpecialtyBasis } from './specialty-catalog';

export interface StaffDegreeDocument {
  title: string;
  path: string;
}

export interface StaffListItem {
  id: string;
  fullName: string;
  email: string | null;
  photo: string | null;
  positionTitle: string | null;
  departmentTitle: string | null;
  facultyTitle: string | null;
  phone: string | null;
  createdAt: string | null;
}

export interface StaffDetail {
  id: string;
  photo: string | null;
  firstName: string | null;
  lastName: string | null;
  middleName: string | null;
  email: string | null;
  phone: string | null;
  jshshir: string | null;
  passportSeries: string | null;
  passportNumber: string | null;
  department: string | null;
  departmentTitle: string | null;
  faculty: string | null;
  facultyTitle: string | null;
  position: string | null;
  positionTitle: string | null;
  academicTitle: string | null;
  academicTitleTitle: string | null;
  googleScholarUrl: string | null;
  scopusUrl: string | null;
  bachelorDegree: StaffDegreeDocument[];
  masterDegree: StaffDegreeDocument[];
  scientificDegree: StaffDegreeDocument[];
  scientificTitle: StaffDegreeDocument[];

  teachingSpecialtyName: string | null;
  teachingSpecialtyCode: string | null;
  teachingSpecialtyBasis: TeachingSpecialtyBasis | null;
  teachingSpecialtyNote: string | null;
}

export interface StaffFormValues {
  photo: File | null;
  existingPhotoUrl: string | null;

  firstName: string;
  lastName: string;
  middleName: string;
  phone: string;
  jshshir: string;
  passportSeries: string;
  passportNumber: string;
  email: string;

  faculty: string | null;
  department: string | null;
  position: string | null;
  academicTitle: string | null;

  googleScholarUrl: string;
  scopusUrl: string;

  bachelorDegree: StaffDegreeDocument[];
  bachelorDegreeNew: File[];
  masterDegree: StaffDegreeDocument[];
  masterDegreeNew: File[];
  scientificDegree: StaffDegreeDocument[];
  scientificDegreeNew: File[];
  scientificTitle: StaffDegreeDocument[];
  scientificTitleNew: File[];

  teachingSpecialtyName: string;
  teachingSpecialtyCode: string;
  teachingSpecialtyBasis: TeachingSpecialtyBasis | null;
  teachingSpecialtyNote: string;
}

export const emptyStaffFormValues: StaffFormValues = {
  photo: null,
  existingPhotoUrl: null,
  firstName: '',
  lastName: '',
  middleName: '',
  phone: '',
  jshshir: '',
  passportSeries: '',
  passportNumber: '',
  email: '',
  faculty: null,
  department: null,
  position: null,
  academicTitle: null,
  googleScholarUrl: '',
  scopusUrl: '',
  bachelorDegree: [],
  bachelorDegreeNew: [],
  masterDegree: [],
  masterDegreeNew: [],
  scientificDegree: [],
  scientificDegreeNew: [],
  scientificTitle: [],
  scientificTitleNew: [],
  teachingSpecialtyName: '',
  teachingSpecialtyCode: '',
  teachingSpecialtyBasis: null,
  teachingSpecialtyNote: '',
};

export interface RefOption {
  id: string;
  title: string;
}
