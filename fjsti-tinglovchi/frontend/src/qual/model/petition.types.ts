import type { EduForm } from './course.types';

export const PETITION_STATUS = { PENDING: 1, APPROVED: 2, REJECTED: 3 } as const;
export type PetitionStatus = (typeof PETITION_STATUS)[keyof typeof PETITION_STATUS];

export interface Petition {
  id: string;
  fullName: string;
  passport: string;
  courseTitle?: string;
  form?: EduForm;
  status: PetitionStatus;
  createdAt?: string;
  courseFull?: boolean;
}

export interface PetitionDetail extends Petition {
  provinceTitle?: string;
  regionTitle?: string;
  institution?: string;
  phone?: string;
  educationType?: number;
  bachelorDiploma?: string;
  mastersDiploma?: string | null;
  moCertificate?: string;
  listenersLimit?: number;
  totalSubscribers?: number;
  courseFull?: boolean;
}
