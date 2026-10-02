import { describe, expect, it } from 'vitest';
import { currentAcademicYear, resolveDefaultAcademicYearId } from './default-year';

describe('currentAcademicYear', () => {
  it("15-avgust — hali o'tgan o'quv yili davom etmoqda", () => {
    expect(currentAcademicYear(new Date(2026, 7, 15))).toBe('2025/2026');
  });

  it('1-sentabr — yangi o‘quv yili shu kuni boshlanadi', () => {
    expect(currentAcademicYear(new Date(2026, 8, 1))).toBe('2026/2027');
  });

  it('31-dekabr — yangi o‘quv yili davom etmoqda', () => {
    expect(currentAcademicYear(new Date(2026, 11, 31))).toBe('2026/2027');
  });

  it("1-yanvar — yangi kalendar yil, lekin o'quv yili sentabrdan hisoblanadi", () => {
    expect(currentAcademicYear(new Date(2027, 0, 1))).toBe('2026/2027');
  });
});

describe('resolveDefaultAcademicYearId', () => {
  const years = [
    { id: 'y2024', title: '2024/2025' },
    { id: 'y2025', title: '2025/2026' },
    { id: 'y2026', title: '2026/2027' },
    { id: 'y2031', title: '2031/2032' },
  ];

  it("joriy o'quv yili ro'yxatda bo'lsa — o'shani tanlaydi (ma'lumotsiz oxirgi yil EMAS)", () => {
    expect(resolveDefaultAcademicYearId(years, new Date(2026, 8, 15))).toBe('y2026');
  });

  it("joriy yil ro'yxatda topilmasa — ro'yxatdagi oxirgi qiymatga qaytadi (avvalgi xulq)", () => {
    expect(resolveDefaultAcademicYearId(years, new Date(2040, 8, 15))).toBe('y2031');
  });

  it("ro'yxat bo'sh bo'lsa — undefined (hech narsa tanlanmaydi)", () => {
    expect(resolveDefaultAcademicYearId([], new Date(2026, 8, 15))).toBeUndefined();
  });
});
