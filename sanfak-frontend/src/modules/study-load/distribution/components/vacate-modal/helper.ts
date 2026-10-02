import type { VacateTeacherPayload } from '../../model/types';

export type AcademicTitleOption = 'phd' | 'docent' | 'professor';

export interface VacateFormValues {
  reason: string;
  requiredPosition: string;
  requiredSpecialization: string;
  requiredAcademicTitle: AcademicTitleOption | '';
  deadline: string;
}

export const vacateEmptyValues: VacateFormValues = {
  reason: '',
  requiredPosition: '',
  requiredSpecialization: '',
  requiredAcademicTitle: '',
  deadline: '',
};

export function buildVacatePayload(values: VacateFormValues): VacateTeacherPayload {
  const payload: VacateTeacherPayload = {};
  if (values.reason.trim()) payload.reason = values.reason.trim();
  if (values.requiredPosition.trim()) payload.requiredPosition = values.requiredPosition.trim();
  if (values.requiredSpecialization.trim()) {
    payload.requiredSpecialization = values.requiredSpecialization.trim();
  }
  if (values.requiredAcademicTitle) payload.requiredAcademicTitle = values.requiredAcademicTitle;
  if (values.deadline) payload.deadline = values.deadline;
  return payload;
}
