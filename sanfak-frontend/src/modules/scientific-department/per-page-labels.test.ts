import { describe, expect, it } from 'vitest';
import scientificDepartmentModule from './scientific-department.module';
import { ACHIEVEMENT_CATEGORIES, midSentence } from './model/achievement-config';

const LOCALES = ['uz', 'ru', 'en'] as const;
const PER_PAGE_KEYS = [
  'myAchievements.hintOne',
  'myAchievements.addTitleOne',
  'myAchievements.editTitleOne',
  'myAchievements.resubmitTitleOne',
];

const dict = (locale: (typeof LOCALES)[number]): Record<string, string> =>
  (scientificDepartmentModule.i18n?.[locale] ?? {}) as Record<string, string>;

describe('alohida sahifa matnlari', () => {
  it.each(LOCALES)('%s — har bir kalit bor va {{name}} bilan', (locale) => {
    const d = dict(locale);
    PER_PAGE_KEYS.forEach((k) => {
      const value = d[`scientificDepartment.${k}`];
      expect(value, `${locale}: ${k}`).toBeTruthy();
      expect(value).toContain('{{name}}');
    });
  });

  it('uz izohda umumiy ro\'yxat yo\'q (bo\'lim nomi qo\'yiladi)', () => {
    const hintOne = dict('uz')['scientificDepartment.myAchievements.hintOne'];
    expect(hintOne).not.toContain('ilmiy daraja, ilmiy unvon');
    expect(hintOne).toContain('bo\'yicha');
  });

  it('har kategoriya nomi tarjima qilingan va gap o\'rtasida kichik harf', () => {
    const d = dict('uz');
    ACHIEVEMENT_CATEGORIES.forEach((cat) => {
      const name = d[`scientificDepartment.${cat.labelKey}`] ?? '';
      expect(name, cat.key).toBeTruthy();
      const mid = midSentence(name);
      expect(mid === name || mid === name.charAt(0).toLowerCase() + name.slice(1)).toBe(true);
    });
    expect(midSentence('Himoya')).toBe('himoya');
    expect(midSentence('AKT guvohnoma')).toBe('AKT guvohnoma');
  });
});
