import type { ResidentBrief } from './types';

export interface Attestation {
  id: string;
  scienceTitle: string;
  specialtyId: string | null;
  specialtyTitle: string | null;
  program: 'magistratura' | 'ordinatura' | null;
  courseNumber: number | null;
  groupTitle: string | null;
  academicYear: string | null;
  academicYearRef: string | null;
  date: string;
}

export interface AttestationResult {
  id: string;
  residentId: string;
  residentName: string | null;
  resident: ResidentBrief | null;
  score: number | null;
  included: boolean;
  excludeReason: string | null;
}

export interface AttestationSummary {
  total: number;
  included: number;
  scored: number;
  avgScore: number | null;
}

export interface AttestationDetail {
  attestation: Attestation;
  summary: AttestationSummary;
}

export function scoreVariant(score: number | null): string {
  if (score === null) return 'umumiy';
  if (score >= 86) return 'success';
  if (score >= 71) return 'info';
  if (score >= 56) return 'warning';
  return 'danger';
}
