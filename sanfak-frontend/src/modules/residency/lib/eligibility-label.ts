import type { EligibilityWindow } from '../api/types';

const ACADEMIC_YEAR_TITLE = /^\d{4}\/\d{4}$/;

const isAcademicYearTitle = (v: unknown): v is string =>
  typeof v === 'string' && ACADEMIC_YEAR_TITLE.test(v);

export function eligibilityHoursLabel(hoursWindow?: EligibilityWindow | null): string {
  if (hoursWindow == null) return 'Sababsiz soat (barcha yillar)';
  if (hoursWindow.source === 'explicit') return 'Sababsiz soat (tanlangan davr)';
  if (isAcademicYearTitle(hoursWindow.academicYear)) {
    return `Sababsiz soat (joriy o‘quv yili, ${hoursWindow.academicYear})`;
  }
  if (hoursWindow.source === 'academicYear') return 'Sababsiz soat (joriy o‘quv yili)';
  return 'Sababsiz soat';
}
