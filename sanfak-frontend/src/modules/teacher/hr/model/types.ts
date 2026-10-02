export type HrApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface DegreeDocument {
  title: string;
  path: string;
}

export interface HrProfileListItem {
  id: string;
  fullName: string;
  positionTitle: string | null;
  departmentTitle: string | null;
  phone: string | null;
  submittedAt: string | null;
  hrApprovalStatus: HrApprovalStatus;
  hrComment: string | null;
}

export interface HrProfileDetail {
  id: string;
  photo: string | null;

  firstName: string | null;
  lastName: string | null;
  middleName: string | null;
  phone: string | null;
  email: string | null;

  jshshir: string | null;
  passportSeries: string | null;
  passportNumber: string | null;
  birthDate: string | null;

  addressRegion: string | null;
  addressDistrict: string | null;
  addressStreet: string | null;

  facultyTitle: string | null;
  departmentTitle: string | null;
  positionTitle: string | null;

  googleScholarUrl: string | null;
  scopusUrl: string | null;

  bachelorDegree: DegreeDocument[];
  masterDegree: DegreeDocument[];
  scientificDegree: DegreeDocument[];
  scientificTitle: DegreeDocument[];

  hrApprovalStatus: HrApprovalStatus;
  hrComment: string | null;
  changedFields: string[];
}

export const EDUCATION_TABS = [
  'bachelorDegree',
  'masterDegree',
  'scientificDegree',
  'scientificTitle',
] as const;
export type EducationTabKey = (typeof EDUCATION_TABS)[number];
