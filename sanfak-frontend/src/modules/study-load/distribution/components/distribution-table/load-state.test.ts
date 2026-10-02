import { describe, expect, it } from 'vitest';
import { loadState } from './load-state';
import type { DistributionTeacher } from '../../model/types';
import manifest from '../../../study-load.module';

function teacher(p: Partial<DistributionTeacher>): DistributionTeacher {
  return {
    id: 't1',
    userId: 'u1',
    fullName: 'Aliyev A.',
    stavka: 1,
    position: 'assistent',
    isVacant: false,
    vacantLabel: null,
    blocks: [],
    totalHour: 0,
    auditoriumHour: 0,
    minHour: 400,
    maxHour: 600,
    acceptanceStatus: 'pending',
    rejectionReason: null,
    respondedAt: null,
    ...p,
  };
}

describe('loadState', () => {
  it('me`yor ichida — ok', () => {
    expect(loadState(teacher({ auditoriumHour: 400 }))).toBe('ok');
    expect(loadState(teacher({ auditoriumHour: 500 }))).toBe('ok');
    expect(loadState(teacher({ auditoriumHour: 600 }))).toBe('ok');
  });

  it('me`yordan kam — under', () => {
    expect(loadState(teacher({ auditoriumHour: 399 }))).toBe('under');
    expect(loadState(teacher({ auditoriumHour: 0 }))).toBe('under');
  });

  it('me`yordan ortiq — over', () => {
    expect(loadState(teacher({ auditoriumHour: 601 }))).toBe('over');
  });

  it('LAVOZIM chegarani o`zgartiradi — bu aynan tuzatilgan nuqson', () => {
    const dotsent = teacher({
      position: 'dotsent',
      minHour: 350,
      maxHour: 525,
      auditoriumHour: 360,
      totalHour: 420,
    });
    expect(loadState(dotsent)).toBe('ok');
  });

  it('vakant yozuv — hech qachon ogohlantirilmaydi', () => {
    expect(loadState(teacher({ isVacant: true, auditoriumHour: 0 }))).toBe('ok');
    expect(loadState(teacher({ isVacant: true, auditoriumHour: 99999 }))).toBe('ok');
  });

  it('vakant yozuvda minHour/maxHour YO`Q bo`lsa ham — ok, crash yo`q (D-129)', () => {
    const vakant = teacher({
      isVacant: true,
      minHour: null,
      maxHour: null,
      totalHour: 150,
      auditoriumHour: 120,
    });
    expect(loadState(vakant)).toBe('ok');
  });

  it('norma yo`q (minHour null) — soxta ogohlantirish bermaydi', () => {
    expect(loadState(teacher({ minHour: null, maxHour: null, auditoriumHour: 0 }))).toBe('ok');
  });

  it('maxHour yo`q bo`lsa — faqat pastki chegara tekshiriladi', () => {
    expect(loadState(teacher({ maxHour: null, auditoriumHour: 99999 }))).toBe('ok');
    expect(loadState(teacher({ maxHour: null, auditoriumHour: 10 }))).toBe('under');
  });
});

describe('loadState — baza `auditoriumHour` (D-129)', () => {
  it('auditoriya min`dan KICHIK — totalHour katta bo`lsa ham `under`', () => {
    const t = teacher({ totalHour: 460, auditoriumHour: 292, minHour: 400, maxHour: 600 });
    expect(loadState(t)).toBe('under');
  });

  it('auditoriya YETARLI — totalHour max`dan katta bo`lsa ham `ok` (soxta xato yo`q)', () => {
    const t = teacher({ totalHour: 900, auditoriumHour: 450, minHour: 400, maxHour: 600 });
    expect(loadState(t)).toBe('ok');
  });

  it('auditoriya max`dan katta — `over` (totalHour kichik bo`lsa ham)', () => {
    const t = teacher({ totalHour: 610, auditoriumHour: 610, minHour: 400, maxHour: 600 });
    expect(loadState(t)).toBe('over');
  });

  it('auditoriumHour YO`Q (eski javob/kesh) — jimgina 0 deb baholanmaydi', () => {
    const t = teacher({ totalHour: 460, auditoriumHour: null, minHour: 400, maxHour: 600 });
    expect(loadState(t)).toBe('ok');
  });
});

describe('D-129 norma matnlari manifestda (uz/ru/en) mavjud', () => {
  const locales = ['uz', 'ru', 'en'] as const;
  const keys = [
    'studyLoad.distribution.teacherRow.auditoriumHour',
    'studyLoad.distribution.loadWarning.under',
    'studyLoad.distribution.loadWarning.over',
    'studyLoad.distribution.loadWarning.basis',
  ];

  it.each(locales)('%s tilida hamma kalit bor va bo`sh emas', (lang) => {
    keys.forEach((key) => {
      const value = manifest.i18n?.[lang]?.[key];
      expect(typeof value, `${lang}/${key}`).toBe('string');
      expect((value as string).trim(), `${lang}/${key}`).not.toBe('');
    });
  });

  it('`basis` matni ikkala o`rin egasini saqlaydi (raqam ko`rinmay qolmasin)', () => {
    locales.forEach((lang) => {
      const value = manifest.i18n?.[lang]?.['studyLoad.distribution.loadWarning.basis'] as string;
      expect(value, lang).toContain('{{value}}');
      expect(value, lang).toContain('{{limit}}');
    });
  });
});
