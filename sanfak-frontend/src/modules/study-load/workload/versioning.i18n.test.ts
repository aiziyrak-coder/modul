import { describe, expect, it } from 'vitest';
import manifest from '../study-load.module';
import { WORKLOAD_VERSION_I18N } from './versioning.i18n';

const LANGS = ['uz', 'ru', 'en'] as const;
const KEYS = [...Object.keys(WORKLOAD_VERSION_I18N.uz), 'studyLoad.summary.status.superseded'];

describe('study-load — ADR-043 versiya i18n kalitlari', () => {
  it.each(LANGS)("%s: barcha kalitlar manifestda bor va bo'sh emas", (lang) => {
    const dict = (manifest.i18n as Record<string, Record<string, string>>)[lang];
    if (!dict) throw new Error(`til lug'ati yo'q: ${lang}`);
    for (const key of KEYS) {
      expect((dict[key] ?? '').trim().length, `${lang} → ${key}`).toBeGreaterThan(0);
    }
  });

  it("uch til lug'ati bir xil kalitlar to'plamiga ega", () => {
    const uz = Object.keys(WORKLOAD_VERSION_I18N.uz).sort();
    expect(Object.keys(WORKLOAD_VERSION_I18N.ru).sort()).toEqual(uz);
    expect(Object.keys(WORKLOAD_VERSION_I18N.en).sort()).toEqual(uz);
  });
});
