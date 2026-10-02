import type { Applicant, ApplicantDocument, DocumentSlot } from '../model/types';
import type { NamedRef } from '../model/admission-types';
import { toForeignStatus } from '../model/status';

const DOCUMENT_SLOT_ORDER: DocumentSlot[] = ['passport', 'diploma', 'certificate'];

type BackendRefValue =
  | string
  | { _id: string; titleUz?: string; titleRu?: string; titleEn?: string }
  | null;

export interface BackendApplicant {
  _id: string;
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
  direction?: BackendRefValue;
  educationForm?: BackendRefValue;
  educationLanguage?: BackendRefValue;
  season?: BackendRefValue;
  academicYear?: string;
  documents?: Partial<
    Record<
      DocumentSlot,
      {
        fileUrl?: string;
        fileName?: string;
        fileSize?: number;
        uploadedAt?: string;
        verified?: boolean;
      }
    >
  >;
  offerAccepted?: boolean;
  status?: string;
  rejectionReason?: string;
  reviewedBy?: { firstName?: string; lastName?: string } | null;
  reviewedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

const personName = (p: BackendApplicant['reviewedBy']): string | undefined =>
  p ? [p.lastName, p.firstName].filter(Boolean).join(' ') || undefined : undefined;

export function mapRef(value: BackendRefValue | undefined): NamedRef | undefined {
  if (!value || typeof value === 'string') return undefined;
  return {
    id: value._id,
    titleUz: value.titleUz ?? '',
    titleRu: value.titleRu,
    titleEn: value.titleEn,
  };
}

function mapDocuments(docs: BackendApplicant['documents']): ApplicantDocument[] {
  if (!docs) return [];
  return DOCUMENT_SLOT_ORDER.filter((slot) => docs[slot]?.fileUrl).map<ApplicantDocument>(
    (slot) => {
      const d = docs[slot]!;
      return {
        slot,
        fileUrl: d.fileUrl!,
        fileName: d.fileName,
        fileSize: d.fileSize,
        uploadedAt: d.uploadedAt,
        verified: d.verified,
      };
    },
  );
}

export function mapApplicant(b: BackendApplicant): Applicant {
  return {
    id: b._id,
    applicationNumber: b.applicationNumber,
    fullName: b.fullName,
    country: b.country,
    phone: b.phone,
    parentPhone: b.parentPhone,
    email: b.email,
    passportNumber: b.passportNumber,
    passportExpiry: b.passportExpiry,
    birthDate: b.birthDate,
    photoUrl: b.photoUrl,
    direction: mapRef(b.direction),
    educationForm: mapRef(b.educationForm),
    educationLanguage: mapRef(b.educationLanguage),
    season: mapRef(b.season),
    academicYear: b.academicYear,
    documents: mapDocuments(b.documents),
    offerAccepted: b.offerAccepted,
    status: toForeignStatus(b.status),
    rejectionReason: b.rejectionReason || undefined,
    reviewedByName: personName(b.reviewedBy),
    reviewedAt: b.reviewedAt,
    notes: b.notes,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}
