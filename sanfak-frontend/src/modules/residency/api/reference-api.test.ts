import { describe, it, expect } from 'vitest';
import { withCurrent, academicYearValue, academicYearWindow } from './reference-api';
import type { AcademicYearOption } from './reference-api';

describe('withCurrent', () => {
  const OPTIONS: AcademicYearOption[] = [
    { id: 'id-2026', title: '2026-2027' },
    { id: 'id-2025', title: '2025-2026' },
    { id: 'id-2024', title: '2024-2025' },
  ];

  it("ro'yxatda bor `id` ni takrorlamaydi", () => {
    expect(withCurrent(OPTIONS, 'id-2025')).toEqual(OPTIONS);
  });

  it("ro'yxatda bor TITUL ni ham takrorlamaydi (eski yozuv)", () => {
    expect(withCurrent(OPTIONS, '2025-2026')).toEqual(OPTIONS);
  });

  it("ro'yxatda YO'Q qiymatni boshiga qo'shadi", () => {
    expect(withCurrent(OPTIONS, '2023-2024')).toEqual([
      { id: '2023-2024', title: '2023-2024' },
      ...OPTIONS,
    ]);
  });

  it('qiymat yo\'q bo\'lsa ro\'yxatni o\'zgartirmaydi', () => {
    expect(withCurrent(OPTIONS, null)).toEqual(OPTIONS);
    expect(withCurrent(OPTIONS, undefined)).toEqual(OPTIONS);
    expect(withCurrent(OPTIONS, '')).toEqual(OPTIONS);
  });

  it("ro'yxat hali yuklanmagan bo'lsa ham joriy qiymat ko'rinadi", () => {
    expect(withCurrent([], '2025-2026')).toEqual([
      { id: '2025-2026', title: '2025-2026' },
    ]);
  });

  it('asl massivni mutatsiya qilmaydi', () => {
    const copy = [...OPTIONS];
    withCurrent(OPTIONS, '2020-2021');
    expect(OPTIONS).toEqual(copy);
  });
});

describe('academicYearValue', () => {
  it("ref bo'lsa REF ni tanlaydi — qayta nomlashdan omon qoladi", () => {
    expect(
      academicYearValue({ academicYearRef: 'id-2025', academicYear: '2025-2026' }),
    ).toBe('id-2025');
  });

  it("ref yo'q bo'lsa eski satrga qaytadi", () => {
    expect(academicYearValue({ academicYear: '1999-2000' })).toBe('1999-2000');
  });

  it("ikkalasi ham yo'q — bo'sh satr", () => {
    expect(academicYearValue({})).toBe('');
    expect(academicYearValue(null)).toBe('');
    expect(academicYearValue(undefined)).toBe('');
  });
});

describe('academicYearWindow', () => {
  it('slash formatidagi titulni sentabr-avgust oynasiga aylantiradi', () => {
    expect(academicYearWindow('2025/2026')).toEqual({
      from: '2025-09-01',
      to: '2026-08-31',
    });
  });

  it('tire formatini ham tushunadi (eski yozuvlar)', () => {
    expect(academicYearWindow('2025-2026')).toEqual({
      from: '2025-09-01',
      to: '2026-08-31',
    });
  });

  it.each(['', '2025', 'kop', null, undefined])("tanib bo'lmasa null (%p)", (v) => {
    expect(academicYearWindow(v)).toBeNull();
  });
});
