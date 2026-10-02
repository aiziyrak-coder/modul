import { describe, expect, it } from 'vitest';
import { requirementLabel } from './vacancy-list-page';
import type { Vacancy } from '../model/types';

const vacancy: Vacancy = {
  distributionId: 'd-1',
  distributionTitle: 'Taqsimot-1',
  distributionStatus: 'draft',
  course: 2,
  department: { id: 'dep-1', title: 'Terapiya kafedrasi' },
  academicYear: { id: 'ay-1', title: '2026-2027' },
  teacherEntryId: 'entry-1',
  vacancyNumber: 1,
  vacantLabel: 'Vakant',
  vacancyReason: null,
  vacantSince: null,
  leave: null,
  totalHour: 120,
  blocks: [],
  requiredPosition: null,
  requiredSpecialization: null,
  requiredAcademicTitle: null,
  deadline: null,
  postedAt: null,
};

const fakeT = (key: string): string => {
  const labels: Record<string, string> = {
    'studyLoad.distribution.vacateModal.academicTitle.docent': 'Dotsent',
    'studyLoad.distribution.vacateModal.academicTitle.phd': 'PhD',
    'studyLoad.distribution.vacateModal.academicTitle.professor': 'Professor',
  };
  return labels[key] ?? key;
};

describe('requirementLabel — "Talab" ustuni (Faza 2)', () => {
  it('requiredSpecialization ENG BIRINCHI — requiredPosition va tarjima qilingan academicTitle bilan', () => {
    const result = requirementLabel(
      { ...vacancy, requiredSpecialization: 'Kardiologiya', requiredPosition: 'Dotsent', requiredAcademicTitle: 'docent' },
      fakeT,
    );
    expect(result).toBe('Kardiologiya, Dotsent, Dotsent');
  });

  it('faqat requiredSpecialization — o\'shani ko\'rsatadi (ilgari umuman ko\'rinmasdi)', () => {
    expect(requirementLabel({ ...vacancy, requiredSpecialization: 'Kardiologiya' }, fakeT)).toBe(
      'Kardiologiya',
    );
  });

  it('hech qanday talab yo\'q — chiziqcha', () => {
    expect(requirementLabel(vacancy, fakeT)).toBe('—');
  });

  it('noma\'lum requiredAcademicTitle — xom i18n key EMAS, xom qiymatning o\'zi ko\'rsatiladi', () => {
    const result = requirementLabel({ ...vacancy, requiredAcademicTitle: 'legacy_value' }, fakeT);
    expect(result).toBe('legacy_value');
    expect(result).not.toContain('studyLoad.distribution.vacateModal.academicTitle');
  });
});
