import { describe, expect, it } from 'vitest';
import manifest from '../study-load.module';
import { REVOKE_FINAL_I18N } from './final-step.i18n';

const KEYS = [
  'action',
  'title',
  'success',
  'notFinalRole',
  'dependentsTitle',
  'dependentsHint',
  'untitled',
  'hiddenDependents',
  'type.workload',
  'type.workloadDistribution',
  'type.workloadSummary',
  'type.syllabus',
].map((k) => `studyLoad.revokeFinal.${k}`);
const LANGS = ['uz', 'ru', 'en'] as const;

describe("study-load — «Tasdiqni bekor qilish» i18n kalitlari", () => {
  it.each(LANGS)("%s: barcha kalitlar manifestda bor va bo'sh emas", (lang) => {
    const dict = (manifest.i18n as Record<string, Record<string, string>>)[lang];
    if (!dict) throw new Error(`til lug'ati yo'q: ${lang}`);
    for (const key of KEYS) {
      expect((dict[key] ?? '').trim().length, `${lang} → ${key}`).toBeGreaterThan(0);
    }
  });

  it("uch til lug'ati bir xil kalitlar to'plamiga ega", () => {
    const uz = Object.keys(REVOKE_FINAL_I18N.uz).sort();
    expect(uz).toEqual([...KEYS].sort());
    expect(Object.keys(REVOKE_FINAL_I18N.ru).sort()).toEqual(uz);
    expect(Object.keys(REVOKE_FINAL_I18N.en).sort()).toEqual(uz);
  });

  it("uz matnlari topshiriq bilan mos", () => {
    const uz = (manifest.i18n as Record<string, Record<string, string> | undefined>).uz;
    expect(uz).toBeDefined();
    expect(uz?.['studyLoad.revokeFinal.action']).toBe('Tasdiqni bekor qilish');
    expect(uz?.['studyLoad.revokeFinal.success']).toBe('Tasdiq bekor qilindi');
    expect(uz?.['studyLoad.revokeFinal.dependentsTitle']).toBe("Avval bog'liq hujjatlarni qaytaring");
  });
});
