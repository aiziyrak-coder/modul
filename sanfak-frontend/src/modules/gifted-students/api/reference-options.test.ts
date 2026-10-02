import { describe, expect, it } from 'vitest';
import {
  toAcademicYearOptions,
  toCourseOptions,
  toDepartmentOptions,
  toDirectionOptions,
  toFacultyOptions,
  toGroupOptions,
} from './reference-options';

describe('reference-options — dedup', () => {
  describe('toAcademicYearOptions', () => {
    it("ma'lumotnomadagi duplikat qator BITTA variant beradi", () => {
      const options = toAcademicYearOptions([
        { _id: 'y1', title: '2025/2026' },
        { _id: 'y2', title: '2025/2026' },
        { _id: 'y3', title: '2025/2026' },
      ]);

      expect(options).toHaveLength(1);
      expect(options.map((o) => o.title)).toEqual(['2025/2026']);
    });

    it('`2025-2026` va `2025/2026` BITTA variantga qo‘shiladi', () => {
      const options = toAcademicYearOptions([
        { _id: 'y1', title: '2025-2026' },
        { _id: 'y2', title: '2025/2026' },
      ]);

      expect(options).toHaveLength(1);
      expect(options[0]?.title).toBe('2025/2026');
    });

    it('prodda ko‘rilgan olti qatorli ro‘yxat ikki variant beradi', () => {
      const options = toAcademicYearOptions([
        { _id: 'a', title: '2026/2027' },
        { _id: 'b', title: '2026/2027' },
        { _id: 'c', title: '2026-2027' },
        { _id: 'd', title: '2025/2026' },
        { _id: 'e', title: '2026/2027' },
        { _id: 'f', title: '2025-2026' },
      ]);

      expect(options.map((o) => o.title)).toEqual(['2026/2027', '2025/2026']);
    });

    it("dedup BIRINCHI qatorni qoldiradi — eksport `_id` si o‘zgarmasin", () => {
      const options = toAcademicYearOptions([
        { _id: 'first', title: '2025/2026' },
        { _id: 'second', title: '2025/2026' },
      ]);

      expect(options[0]?.id).toBe('first');
    });

    it("saralash saqlanadi — eng yangisi birinchi", () => {
      const options = toAcademicYearOptions([
        { _id: '1', title: '2023/2024' },
        { _id: '2', title: '2025/2026' },
        { _id: '3', title: '2024/2025' },
      ]);

      expect(options.map((o) => o.title)).toEqual(['2025/2026', '2024/2025', '2023/2024']);
    });
  });

  describe('toCourseOptions', () => {
    it('duplikat kurs qatori BITTA katakcha beradi', () => {
      const options = toCourseOptions([
        { _id: 'c1', title: '1-kurs' },
        { _id: 'c2', title: '1-kurs' },
        { _id: 'c3', title: '2-kurs' },
      ]);

      expect(options.map((o) => o.number)).toEqual([1, 2]);
      expect(new Set(options.map((o) => String(o.number))).size).toBe(options.length);
    });

    it('raqami bir xil, sarlavhasi har xil qatorlar ham qo‘shiladi', () => {
      const options = toCourseOptions([
        { _id: 'c1', title: '1-kurs' },
        { _id: 'c2', title: '1-KURS' },
      ]);

      expect(options).toHaveLength(1);
    });

    it('raqamsiz qator tushib qoladi va saralash raqam bo‘yicha', () => {
      const options = toCourseOptions([
        { _id: 'c3', title: '3-kurs' },
        { _id: 'cx', title: 'mag-1' },
        { _id: 'c1', title: '1-kurs' },
      ]);

      expect(options.map((o) => o.number)).toEqual([1, 3]);
    });
  });

  describe('toFacultyOptions', () => {
    it('bir xil nomli ikki qator BITTA variant beradi', () => {
      const options = toFacultyOptions([
        { _id: 'f1', title: 'Farmatsevtika' },
        { _id: 'f2', title: 'Farmatsevtika' },
        { _id: 'f3', title: 'Tibbiyot' },
      ]);

      expect(options.map((o) => o.title)).toEqual(['Farmatsevtika', 'Tibbiyot']);
    });
  });

  describe('toDirectionOptions', () => {
    it('bir fakultetdagi duplikat yo‘nalish BITTA variant beradi', () => {
      const options = toDirectionOptions([
        { _id: 'd1', title: 'Farmatsevtik tahlil', faculty: { title: 'Farmatsevtika' } },
        { _id: 'd2', title: 'Farmatsevtik tahlil', faculty: { title: 'Farmatsevtika' } },
      ]);

      expect(options).toHaveLength(1);
    });

    it('🔴 BOSHQA fakultetdagi bir xil nomli yo‘nalish SAQLANADI', () => {
      const options = toDirectionOptions([
        { _id: 'd1', title: 'Davolash ishi', faculty: { title: 'Tibbiyot' } },
        { _id: 'd2', title: 'Davolash ishi', faculty: { title: 'Pediatriya' } },
      ]);

      expect(options).toHaveLength(2);
      expect(options.map((o) => o.facultyTitle)).toEqual(['Tibbiyot', 'Pediatriya']);
    });
  });

  describe('toGroupOptions', () => {
    it('aynan bir xil guruh qatori BITTA variant beradi', () => {
      const row = {
        title: 'Farm-101',
        course: { _id: 'c1', title: '1-kurs' },
        direction: { title: 'Farmatsevtika' },
      };
      const options = toGroupOptions([
        { _id: 'g1', ...row },
        { _id: 'g2', ...row },
      ]);

      expect(options).toHaveLength(1);
      expect(options[0]).toMatchObject({ title: 'Farm-101', courseId: 'c1', course: 1 });
    });

    it('🔴 boshqa KURSDAGI yoki boshqa YO‘NALISHDAGI bir xil nomli guruh SAQLANADI', () => {
      const options = toGroupOptions([
        { _id: 'g1', title: 'Farm-101', course: { _id: 'c1', title: '1-kurs' }, direction: { title: 'Farmatsevtika' } },
        { _id: 'g2', title: 'Farm-101', course: { _id: 'c2', title: '2-kurs' }, direction: { title: 'Farmatsevtika' } },
        { _id: 'g3', title: 'Farm-101', course: { _id: 'c1', title: '1-kurs' }, direction: { title: 'Tibbiyot' } },
      ]);

      expect(options).toHaveLength(3);
    });

    it('populate qilinmagan (xom id) kurs ham qo‘llab-quvvatlanadi', () => {
      const options = toGroupOptions([
        { _id: 'g1', title: 'Farm-101', course: 'c1', direction: { title: 'Farmatsevtika' } },
        { _id: 'g2', title: 'Farm-101', course: 'c1', direction: { title: 'Farmatsevtika' } },
      ]);

      expect(options).toHaveLength(1);
      expect(options[0]?.courseId).toBe('c1');
    });
  });

  describe('toDepartmentOptions', () => {
    it('aynan bir qatorning ikki marta kelishi BITTA variant beradi', () => {
      const options = toDepartmentOptions([
        { _id: 'dep1', title: 'Farmakologiya', faculty: { title: 'Farmatsevtika' } },
        { _id: 'dep1', title: 'Farmakologiya', faculty: { title: 'Farmatsevtika' } },
      ]);

      expect(options).toHaveLength(1);
    });

    it('🔴 bir xil nomli, HAR XIL `_id` li kafedralar SAQLANADI', () => {
      const options = toDepartmentOptions([
        { _id: 'dep1', title: 'Farmakologiya', faculty: { title: 'Farmatsevtika' } },
        { _id: 'dep2', title: 'Farmakologiya', faculty: { title: 'Tibbiyot' } },
      ]);

      expect(options.map((o) => o.id)).toEqual(['dep1', 'dep2']);
    });
  });
});
