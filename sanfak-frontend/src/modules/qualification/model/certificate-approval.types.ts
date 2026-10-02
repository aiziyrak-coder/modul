export const CERT_STATUS = {
  PENDING: 1,
  APPROVED: 2,
  REJECTED: 3,
} as const;

export type CertStatus = (typeof CERT_STATUS)[keyof typeof CERT_STATUS];

export const CERT_KIND = { CERTIFICATE: 1, REFERENCE: 2 } as const;

export type CertKind = (typeof CERT_KIND)[keyof typeof CERT_KIND];

export interface CertificateRow {
  id: string;
  listenerName: string;
  courseName: string;
  creditHours: number | null;
  startDate: string | null;
  endDate: string | null;
  kind: CertKind;
  code: string;
  regNumber: string;
  status: CertStatus;
  approvedBy: string;
  approvedAt: string | null;
  rejectReason: string;
  createdAt: string | null;
  file: string;
}
