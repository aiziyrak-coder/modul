import { describe, expect, it } from 'vitest';
import manifest from './study-load.module';

const KEYS = ['action.reopen', 'reopenTitle', 'reopenSubtitle', 'reopened'] as const;
const ENTITIES = ['scienceProgram', 'syllabus'] as const;
const LANGS = ['uz', 'ru', 'en'] as const;

describe('study-load — L-10 «Qayta ochish» i18n kalitlari (fan dasturi + sillabus)', () => {
  it.each(ENTITIES)('%s: 4 kalit uz/ru/en da bor va bo\'sh emas', (entity) => {
    for (const lang of LANGS) {
      const dict = (manifest.i18n as Record<string, Record<string, string>>)[lang];
      if (!dict) throw new Error(`til lug'ati yo'q: ${lang}`);
      for (const key of KEYS) {
        const full = `studyLoad.${entity}.${key}`;
        const value = dict[full];
        expect(typeof value, `${lang} → ${full}`).toBe('string');
        expect((value ?? '').trim().length, `${lang} → ${full} bo'sh`).toBeGreaterThan(0);
      }
    }
  });
});
