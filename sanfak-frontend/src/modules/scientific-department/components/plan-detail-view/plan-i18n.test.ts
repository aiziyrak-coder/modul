import { describe, expect, it } from 'vitest';
import manifest from '../../scientific-department.module';

const PREFIXES = ['workPlans', 'annualReports'];
const DYNAMIC_KEYS = ['detailTitle', 'file'];
const LANGS = ['uz', 'ru', 'en'];

describe('PlanDetailView dinamik i18n kalitlari', () => {
  const i18n = manifest.i18n as Record<string, Record<string, string>> | undefined;

  it('har bir prefiks × kalit × til uchun tarjima bor', () => {
    expect(i18n, 'manifest i18n topilmadi').toBeDefined();

    for (const prefix of PREFIXES) {
      for (const k of DYNAMIC_KEYS) {
        const key = `scientificDepartment.${prefix}.${k}`;
        for (const lang of LANGS) {
          expect(i18n?.[lang]?.[key], `${lang} tilida yo'q: ${key}`).toBeDefined();
        }
      }
    }
  });

  it('ikki entity yorliqlari bir xil emas (nusxa-tashla xatosi)', () => {
    for (const k of DYNAMIC_KEYS) {
      for (const lang of LANGS) {
        const a = i18n?.[lang]?.[`scientificDepartment.workPlans.${k}`];
        const b = i18n?.[lang]?.[`scientificDepartment.annualReports.${k}`];
        expect(a, `${lang}: ${k}`).not.toBe(b);
      }
    }
  });
});
