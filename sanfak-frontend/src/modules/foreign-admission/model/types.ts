import type { NamedRef } from './admission-types';

export type ForeignStatus = 'yangi' | 'tasdiqlangan' | 'radEtilgan';

export type { NamedRef } from './admission-types';

export type DocumentSlot = 'passport' | 'diploma' | 'certificate';

export interface ApplicantDocument {
  slot: DocumentSlot;
  fileUrl: string;
  fileName?: string;
  fileSize?: number;
  uploadedAt?: string;
  verified?: boolean;
}

export interface Applicant {
  id: string;
  applicationNumber?: string;
  fullName: string;
  country: string;
  phone?: string;
  parentPhone?: string;
  email?: string;
  passportNumber?: string;
  passportExpiry?: string;
  birthDate?: string;
  photoUrl?: string;
  direction?: NamedRef;
  educationForm?: NamedRef;
  educationLanguage?: NamedRef;
  season?: NamedRef;
  academicYear?: string;
  documents: ApplicantDocument[];
  offerAccepted?: boolean;
  status: ForeignStatus;
  rejectionReason?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
