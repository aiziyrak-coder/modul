export const CERT_STATUS = { PENDING: 1, APPROVED: 2, REJECTED: 3 } as const;

export type CertStatus = (typeof CERT_STATUS)[keyof typeof CERT_STATUS];

export interface EarnedDocument {
  id: string;
  courseId: string;
  courseName: string;
  courseType: string;
  form: number | null;
  creditHours: number;
  startDate: string;
  endDate: string;
  kind: 1 | 2;
  percentage: number;
  fileUrl: string | null;
  surveyRequired: boolean;
  surveyDone: boolean;
  certStatus: CertStatus;
  rejectReason: string;
  issuedDate: string;
}
