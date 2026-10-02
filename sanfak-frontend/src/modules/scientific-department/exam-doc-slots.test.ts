import { describe, expect, it } from 'vitest';
import {
  APPLICANT_DOC_SLOTS,
  LEGACY_APPLICANT_DOC_SLOTS,
} from './model/types';
import scientificDepartmentModule from './scientific-department.module';

const LOCALES = ['uz', 'ru', 'en'] as const;

describe('malakaviy imtihon hujjat slotlari', () => {
  it('rasmiy 7 ta hujjat, backend tartibida', () => {
    expect([...APPLICANT_DOC_SLOTS]).toEqual([
      'referral',
      'application',
      'passport',
      'diploma',
      'objektivka',
      'topic',
      'order',
    ]);
  });

  it("eski 'personal' formada yo'q, lekin legacy sifatida saqlanadi", () => {
    expect(APPLICANT_DOC_SLOTS).not.toContain('personal');
    expect([...LEGACY_APPLICANT_DOC_SLOTS]).toEqual(['personal']);
  });

  it.each(LOCALES)('%s — har bir slot (legacy ham) tarjimasi bor', (locale) => {
    const dict = (scientificDepartmentModule.i18n?.[locale] ?? {}) as Record<string, string>;
    [...APPLICANT_DOC_SLOTS, ...LEGACY_APPLICANT_DOC_SLOTS].forEach((slot) => {
      expect(dict[`scientificDepartment.exam.doc.${slot}`], `${locale}: ${slot}`).toBeTruthy();
    });
  });
});
