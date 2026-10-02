import { describe, expect, it } from 'vitest';
import { buildOverloadWarningMessage } from './overload-warning';
import type { OverloadWarning } from '../api/distribution-api';
import manifest from '../../study-load.module';

const fakeT = (key: string, options?: Record<string, unknown>) =>
  `${key}|${JSON.stringify(options ?? {})}`;

function makeWarning(overrides: Partial<OverloadWarning> = {}): OverloadWarning {
  return {
    teacherEntryId: 't1',
    totalHour: 900,
    maxHour: 600,
    excess: 300,
    message: 'Ortiqcha yuklama: 900 > 600 (1.5× normadan oshib ketdi)',
    severity: 'warning',
    ...overrides,
  };
}

describe('buildOverloadWarningMessage', () => {
  it('warnings yo\'q (undefined) bo\'lsa — null (ogohlantirish ko\'rsatilmaydi)', () => {
    expect(buildOverloadWarningMessage(fakeT, undefined)).toBeNull();
  });

  it('warnings bo\'sh massiv bo\'lsa — null (soxta ogohlantirish chiqmaydi)', () => {
    expect(buildOverloadWarningMessage(fakeT, [])).toBeNull();
  });

  it('bitta ogohlantirish — count=1, excess=uning o\'zi', () => {
    const result = buildOverloadWarningMessage(fakeT, [makeWarning({ excess: 120 })]);
    expect(result).toContain('"count":1');
    expect(result).toContain('"excess":120');
  });

  it('bir nechta ogohlantirish — count=soni, excess=ENG KATTASI', () => {
    const result = buildOverloadWarningMessage(fakeT, [
      makeWarning({ excess: 50 }),
      makeWarning({ excess: 300 }),
      makeWarning({ excess: 120 }),
    ]);
    expect(result).toContain('"count":3');
    expect(result).toContain('"excess":300');
  });

  it('i18n kalitidan quriladi — backendning xom o\'zbekcha `message` maydoni ISHLATILMAYDI (D-128 bilan bir xatoni takrorlamaslik)', () => {
    const backendRawMessage = 'Ortiqcha yuklama: 900 > 600 (1.5× normadan oshib ketdi)';
    const result = buildOverloadWarningMessage(fakeT, [makeWarning({ message: backendRawMessage })]);
    expect(result).toContain('studyLoad.distribution.overloadWarning');
    expect(result).not.toContain(backendRawMessage);
  });
});

describe('studyLoad.distribution.overloadWarning manifestda (uz/ru/en) mavjud', () => {
  const locales = ['uz', 'ru', 'en'] as const;

  it.each(locales)('%s tilida mavjud va bo\'sh emas', (lang) => {
    const value = manifest.i18n?.[lang]?.['studyLoad.distribution.overloadWarning'];
    expect(typeof value).toBe('string');
    expect((value as string).trim()).not.toBe('');
  });
});

describe('overload ogohlantirishi — auditoriya bazasi (D-129)', () => {
  it('seam `auditoriumHour` ni tashib o\'tadi va `excess` o\'shandan hisoblanadi', () => {
    const w = makeWarning({ totalHour: 900, auditoriumHour: 650, maxHour: 600, excess: 50 });

    expect(w.auditoriumHour).toBe(650);
    expect(w.excess).toBe((w.auditoriumHour ?? 0) - w.maxHour);

    const result = buildOverloadWarningMessage(fakeT, [w]);
    expect(result).toContain('"excess":50');
  });

  it.each(['uz', 'ru', 'en'] as const)(
    '%s matni auditoriya bazasini aytadi (jami soat deb tushunilmasin)',
    (lang) => {
      const value = manifest.i18n?.[lang]?.['studyLoad.distribution.overloadWarning'] as string;
      expect(value.toLowerCase()).toMatch(/auditoriya|аудиторн|auditorium/);
    },
  );
});
