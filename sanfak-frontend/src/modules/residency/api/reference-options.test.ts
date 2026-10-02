import { describe, expect, it } from 'vitest';
import {
  toAcademicYearOptions,
  toCourseOptions,
  toEducationFormOptions,
  toRefOptions,
  toRoomOptions,
  toSpecialtyOptions,
  activeWithCurrent,
} from './reference-options';
import type { Specialty } from './types';

describe('reference-options — dedup', () => {
  describe("toAcademicYearOptions — kalit `id`", () => {
    it('aynan bir qatorning ikki marta kelishi BITTA variant beradi', () => {
      const options = toAcademicYearOptions([
        { _id: 'y1', title: '2025/2026' },
        { _id: 'y1', title: '2025/2026' },
        { _id: 'y1', title: '2025/2026' },
      ]);

      expect(options).toHaveLength(1);
      expect(options.map((o) => o.title)).toEqual(['2025/2026']);
    });

    it('🔴 bir xil sarlavhali, HAR XIL `_id` li yillar SAQLANADI', () => {
      const options = toAcademicYearOptions([
        { _id: 'y1', title: '2025/2026' },
        { _id: 'y2', title: '2025/2026' },
      ]);

      expect(options.map((o) => o.id)).toEqual(['y1', 'y2']);
    });

    it('nofaol yil ro‘yxatga kirmaydi, `active` yo‘q qator esa kiradi', () => {
      const options = toAcademicYearOptions([
        { _id: 'y1', title: '2025/2026', active: false },
        { _id: 'y2', title: '2024/2025' },
        { _id: 'y3', title: '2023/2024', active: true },
      ]);

      expect(options.map((o) => o.id)).toEqual(['y2', 'y3']);
    });

    it('saralash saqlanadi — eng yangisi birinchi', () => {
      const options = toAcademicYearOptions([
        { _id: '1', title: '2023/2024' },
        { _id: '2', title: '2025/2026' },
        { _id: '3', title: '2024/2025' },
      ]);

      expect(options.map((o) => o.title)).toEqual(['2025/2026', '2024/2025', '2023/2024']);
    });
  });

  describe('toCourseOptions — kalit RAQAM (qiymat sarlavhadan hosil bo‘ladi)', () => {
    it('duplikat kurs qatori BITTA variant beradi', () => {
      const options = toCourseOptions([
        { _id: 'c1', title: '1-kurs' },
        { _id: 'c2', title: '1-kurs' },
        { _id: 'c3', title: '2-kurs' },
      ]);

      expect(options.map((o) => o.number)).toEqual([1, 2]);
      expect(new Set(options.map((o) => String(o.number))).size).toBe(options.length);
    });

    it('sarlavhasi har xil, RAQAMI bir xil qatorlar ham qo‘shiladi', () => {
      const options = toCourseOptions([
        { _id: 'c1', title: '1-kurs' },
        { _id: 'c2', title: '1-KURS' },
      ]);

      expect(options).toHaveLength(1);
      expect(options[0]?.id).toBe('c1');
    });

    it('raqamsiz qator tushib qoladi va saralash raqam bo‘yicha', () => {
      const options = toCourseOptions([
        { _id: 'c3', title: '3-kurs' },
        { _id: 'cx', title: 'Tayyorlov' },
        { _id: 'c1', title: '1-kurs' },
      ]);

      expect(options.map((o) => o.number)).toEqual([1, 3]);
    });

    it('nofaol kurs ro‘yxatga kirmaydi', () => {
      const options = toCourseOptions([
        { _id: 'c1', title: '1-kurs', active: false },
        { _id: 'c2', title: '2-kurs' },
      ]);

      expect(options.map((o) => o.number)).toEqual([2]);
    });
  });

  describe('toEducationFormOptions — kalit `value` (lowercase sarlavha)', () => {
    it('🔴 «Kunduzgi» va «kunduzgi» BITTA variant beradi', () => {
      const options = toEducationFormOptions([
        { _id: 'e1', title: 'Kunduzgi' },
        { _id: 'e2', title: 'kunduzgi' },
        { _id: 'e3', title: 'Sirtqi' },
      ]);

      expect(options).toHaveLength(2);
      expect(options.map((o) => o.value)).toEqual(['kunduzgi', 'sirtqi']);
    });

    it('yorliq BIRINCHI qatordan olinadi', () => {
      const options = toEducationFormOptions([
        { _id: 'e1', title: 'Kunduzgi' },
        { _id: 'e2', title: 'KUNDUZGI' },
      ]);

      expect(options[0]?.title).toBe('Kunduzgi');
    });

    it('bo‘shliq ham hisobga olinadi (`" Kechki "` = `"kechki"`)', () => {
      const options = toEducationFormOptions([
        { _id: 'e1', title: ' Kechki ' },
        { _id: 'e2', title: 'Kechki' },
      ]);

      expect(options).toHaveLength(1);
    });

    it('qotirilgan ro‘yxat YO‘Q — admin qo‘shgan shakl ham chiqadi', () => {
      const options = toEducationFormOptions([
        { _id: 'e1', title: 'Kunduzgi' },
        { _id: 'e2', title: 'Sirtqi' },
        { _id: 'e3', title: 'Kechki' },
      ]);

      expect(options.map((o) => o.value)).toEqual(['kunduzgi', 'sirtqi', 'kechki']);
    });
  });

  describe('toRoomOptions — kalit `id`', () => {
    it('aynan bir qatorning ikki marta kelishi BITTA variant beradi', () => {
      const row = { _id: 'r1', title: '101-xona', building: 'Asosiy bino', capacity: 120 };
      const options = toRoomOptions([row, row]);

      expect(options).toHaveLength(1);
      expect(options[0]?.label).toBe('101-xona · Asosiy bino · 120 o‘rin');
    });

    it('🔴 har binodagi bir xil nomli xona SAQLANADI', () => {
      const options = toRoomOptions([
        { _id: 'r1', title: '101-xona', building: 'Asosiy bino' },
        { _id: 'r2', title: '101-xona', building: 'Klinika' },
      ]);

      expect(options.map((o) => o.id)).toEqual(['r1', 'r2']);
      expect(options.map((o) => o.label)).toEqual(['101-xona · Asosiy bino', '101-xona · Klinika']);
    });

    it('nofaol xona ro‘yxatga kirmaydi', () => {
      const options = toRoomOptions([
        { _id: 'r1', title: '101-xona', active: false },
        { _id: 'r2', title: '102-xona' },
      ]);

      expect(options.map((o) => o.id)).toEqual(['r2']);
    });
  });

  describe('toRefOptions — kafedra · guruh · fan, kalit `id`', () => {
    it('aynan bir qatorning ikki marta kelishi BITTA variant beradi', () => {
      const options = toRefOptions([
        { _id: 'g1', title: 'ORD-101' },
        { _id: 'g1', title: 'ORD-101' },
      ]);

      expect(options).toHaveLength(1);
    });

    it('🔴 bir xil nomli, HAR XIL `_id` li kafedralar SAQLANADI', () => {
      const options = toRefOptions([
        { _id: 'dep1', title: 'Farmakologiya' },
        { _id: 'dep2', title: 'Farmakologiya' },
      ]);

      expect(options.map((o) => o.id)).toEqual(['dep1', 'dep2']);
    });

    it('🔴 KASKAD: har xil kursdagi bir xil nomli guruh SAQLANADI', () => {
      const options = toRefOptions([
        { _id: 'g1', title: 'ORD-101' },
        { _id: 'g2', title: 'ORD-101' },
        { _id: 'g3', title: 'ORD-201' },
      ]);

      expect(options).toHaveLength(3);
    });

    it('`name` maydonli ma‘lumotnoma ham qo‘llab-quvvatlanadi', () => {
      const options = toRefOptions([{ _id: 's1', name: 'Kardiologiya' }]);

      expect(options).toEqual([{ id: 's1', title: 'Kardiologiya' }]);
    });
  });

  describe('toSpecialtyOptions — kalit `id`', () => {
    const spec = (id: string, title: string, program: Specialty['program']): Specialty => ({
      id,
      title,
      code: null,
      program,
      studyPeriod: null,
      departmentId: null,
      departmentTitle: null,
      active: true,
    });

    it('aynan bir qatorning ikki marta kelishi BITTA variant beradi', () => {
      const row = spec('s1', 'Kardiologiya', 'ordinatura');
      const options = toSpecialtyOptions([row, row]);

      expect(options).toHaveLength(1);
    });

    it('🔴 KASKAD: bir xil nomli, HAR XIL DASTURDAGI mutaxassislik SAQLANADI', () => {
      const options = toSpecialtyOptions([
        spec('s1', 'Kardiologiya', 'ordinatura'),
        spec('s2', 'Kardiologiya', 'magistratura'),
      ]);

      expect(options.map((o) => o.id)).toEqual(['s1', 's2']);
    });

    it('tartib va maydonlar tegilmaydi', () => {
      const rows = [spec('s2', 'Nevrologiya', 'ordinatura'), spec('s1', 'Kardiologiya', 'ordinatura')];

      expect(toSpecialtyOptions(rows)).toEqual(rows);
    });
  });

  describe('activeWithCurrent — piker faolligi + tahrirlash himoyasi', () => {
    const row = (id: string, active: boolean) => ({ id, title: id, active });

    it('nofaol qator ro`yxatdan chiqadi', () => {
      expect(activeWithCurrent([row('a', true), row('b', false)]).map((r) => r.id)).toEqual(['a']);
    });

    it('`active` maydoni YO`Q qator faol hisoblanadi (orqaga moslik)', () => {
      expect(activeWithCurrent([{ id: 'a', title: 'a' }]).map((r) => r.id)).toEqual(['a']);
    });

    it('🔴 tahrirlanayotgan NOFAOL joriy qiymat ro`yxatda QOLADI', () => {
      const rows = [row('eski', false), row('yangi', true)];

      expect(activeWithCurrent(rows, 'eski').map((r) => r.id)).toEqual(['eski', 'yangi']);
    });

    it('joriy qiymat FAOL bo`lsa ro`yxat ikki marta chizmaydi', () => {
      const rows = [row('a', true), row('b', true)];

      expect(activeWithCurrent(rows, 'a').map((r) => r.id)).toEqual(['a', 'b']);
    });

    it('joriy qiymat umuman topilmasa qo`shib qo`yilmaydi (xom id chiqmaydi)', () => {
      expect(activeWithCurrent([row('a', true)], 'yoq').map((r) => r.id)).toEqual(['a']);
    });

    it('joriy qiymat berilmasa oddiy faollik filtri', () => {
      const rows = [row('a', true), row('b', false)];

      expect(activeWithCurrent(rows, '').map((r) => r.id)).toEqual(['a']);
      expect(activeWithCurrent(rows, null).map((r) => r.id)).toEqual(['a']);
      expect(activeWithCurrent(rows, undefined).map((r) => r.id)).toEqual(['a']);
    });
  });
});
