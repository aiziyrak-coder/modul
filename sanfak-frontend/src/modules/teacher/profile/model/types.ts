export type Gender = 'male' | 'female';
export type HrApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface DegreeDocument {
  id: string;
  title: string;
  path: string;
}

export const EDUCATION_TABS = [
  'bachelorDegree',
  'masterDegree',
  'scientificDegree',
  'scientificTitle',
] as const;
export type EducationTabKey = (typeof EDUCATION_TABS)[number];

export type DegreesByType = Record<EducationTabKey, DegreeDocument[]>;

export const EMPTY_DEGREES: DegreesByType = {
  bachelorDegree: [],
  masterDegree: [],
  scientificDegree: [],
  scientificTitle: [],
};

export interface TeacherProfile {
  id: string | null;
  userId: string | null;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  middleName: string | null;
  photo: string | null;

  departmentId: string | null;
  departmentTitle: string | null;
  facultyId: string | null;
  facultyTitle: string | null;
  positionId: string | null;
  positionTitle: string | null;

  birthDate: string | null;
  gender: Gender | null;
  passportSeries: string | null;
  passportNumber: string | null;
  jshshir: string | null;
  addressRegion: string | null;
  addressDistrict: string | null;
  addressStreet: string | null;

  phone: string | null;
  email: string | null;

  googleScholarUrl: string | null;
  scopusUrl: string | null;

  degrees: DegreesByType;

  hrApprovalStatus: HrApprovalStatus;
  hrApprovedByName: string | null;
  hrApprovalDate: string | null;
  hrComment: string | null;
}

export interface ProfileFormValues {
  faculty: string | null;
  department: string | null;
  position: string | null;
  phone: string | null;
  email: string | null;
  googleScholarUrl: string | null;
  scopusUrl: string | null;
}

export const SCIENTIFIC_WORK_TABS = ['articles', 'theses', 'monographs', 'methodical'] as const;
export type ScientificWorkTabKey = (typeof SCIENTIFIC_WORK_TABS)[number];

export type ScientificWorkStatus = 'new' | 'pending' | 'approved' | 'rejected';

export interface ScientificWorkItem {
  id: string;
  title: string;
  status: ScientificWorkStatus;
  fileUrl: string | null;
}
