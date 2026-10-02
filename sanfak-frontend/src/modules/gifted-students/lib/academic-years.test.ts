import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ACADEMIC_YEAR,
  academicYearOf,
  canonicalAcademicYear,
  currentAcademicYear,
  resolveDefaultYear,
} from './academic-years';

describe('academic-years', () => {
  describe('currentAcademicYear — kanonik YYYY/YYYY', () => {
    it("1-sentabrgacha oldingi yil davom etadi", () => {
      expect(currentAcademicYear(new Date('2026-08-31T00:00:00Z'))).toBe('2025/2026');
    });

    it("1-sentabrdan joriy yil suriladi", () => {
      expect(currentAcademicYear(new Date('2026-09-01T00:00:00Z'))).toBe('2026/2027');
    });

    it('tire EMAS, slash ishlatiladi (platforma kanonik shakli)', () => {
      expect(currentAcademicYear(new Date('2026-08-09T00:00:00Z'))).not.toContain('-');
    });
  });

  describe('canonicalAcademicYear', () => {
    it.each([
      ['2025-2026', '2025/2026'],
      ['2025/2026', '2025/2026'],
      ['2025 - 2026', '2025/2026'],
      ['2025–2026', '2025/2026'],
    ])('%s -> %s', (input, expected) => {
      expect(canonicalAcademicYear(input)).toBe(expected);
    });

    it("bo'sh qiymat bo'sh satr", () => {
      expect(canonicalAcademicYear('')).toBe('');
      expect(canonicalAcademicYear(null)).toBe('');
      expect(canonicalAcademicYear(undefined)).toBe('');
    });

    it("tanilmagan shakl O'ZGARTIRILMAYDI (ma'lumot yo'qotilmasin)", () => {
      expect(canonicalAcademicYear('kuzgi semestr')).toBe('kuzgi semestr');
    });
  });

  describe('academicYearOf — sanadan', () => {
    it('faoliyat sanasidan o\'quv yilini beradi', () => {
      expect(academicYearOf('2026-10-15')).toBe('2026/2027');
      expect(academicYearOf('2026-03-15')).toBe('2025/2026');
    });

    it("bo'sh yoki buzuq sana joriy yilga tushadi", () => {
      expect(academicYearOf('')).toBe(DEFAULT_ACADEMIC_YEAR);
      expect(academicYearOf('salom')).toBe(DEFAULT_ACADEMIC_YEAR);
    });
  });

  describe('resolveDefaultYear — R1 qulfi', () => {
    it('joriy yil ma\'lumotnomada bo\'lsa — O\'SHA, eng yangisi EMAS', () => {
      const current = currentAcademicYear();
      const titles = ['2027/2028', current, '2023/2024'];
      expect(resolveDefaultYear(titles)).toBe(current);
      expect(resolveDefaultYear(titles)).not.toBe(titles[0]);
    });

    it("joriy yil ma'lumotnomada yo'q bo'lsa — eng yangisi", () => {
      expect(resolveDefaultYear(['2019/2020', '2021/2022', '2020/2021'])).toBe('2021/2022');
    });

    it("ro'yxat hali yuklanmagan bo'lsa — sanadan hisoblangan yil", () => {
      expect(resolveDefaultYear([])).toBe(DEFAULT_ACADEMIC_YEAR);
    });
  });
});
