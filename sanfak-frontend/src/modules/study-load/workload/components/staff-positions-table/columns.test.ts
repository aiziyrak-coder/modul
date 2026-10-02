import { describe, expect, it } from 'vitest';
import { averageLoad, buildStaffPositionsPayload, staffCellValue, sumStaffGroup, STAFF_GROUPS } from './columns';
import type { StaffPositionItem } from '../../model/detail-types';

const items: StaffPositionItem[] = [
  { id: 'sp-1', category: 'departmentHead', slug: 'professor', positions: 1, load: 300, totalHours: 300, hourly: 0 },
  { id: 'sp-2', category: 'teachingStaff', slug: 'docent', positions: 2, load: 350, totalHours: 700, hourly: 40 },
  { id: 'sp-3', category: 'teachingStaff', slug: 'assistant', positions: 2, load: 400, totalHours: 800, hourly: 25 },
];

describe('staffCellValue', () => {
  it('draft bo\'lsa draft qiymatini, bo\'lmasa backend qiymatini qaytaradi', () => {
    expect(staffCellValue(items, {}, 'departmentHead', 'professor', 'positions')).toBe(1);
    expect(staffCellValue(items, {}, 'departmentHead', 'professor', 'load')).toBe(300);
    expect(staffCellValue(items, {}, 'supportStaff', 'laborant', 'positions')).toBe(0);
  });

  it('draft mavjud bo\'lsa backend qiymatidan ustun turadi', () => {
    const drafts = { 'departmentHead:professor': { positions: 5, load: 300, hourly: 0 } };
    expect(staffCellValue(items, drafts, 'departmentHead', 'professor', 'positions')).toBe(5);
  });

  it('`hourly` (Soatbay) — draft yoki backend qiymati', () => {
    expect(staffCellValue(items, {}, 'teachingStaff', 'docent', 'hourly')).toBe(40);
    const drafts = { 'teachingStaff:docent': { positions: 2, load: 350, hourly: 55 } };
    expect(staffCellValue(items, drafts, 'teachingStaff', 'docent', 'hourly')).toBe(55);
  });
});

describe('averageLoad', () => {
  it('12600 / 16 → 787.5 → 788; butun son; ish o`rni 0 → 0', () => {
    expect(averageLoad(12600, 16)).toBe(788);
    expect(averageLoad(1000, 3)).toBe(333);
    expect(averageLoad(166, 12)).toBe(14);
    expect(averageLoad(1000, 0)).toBe(0);
  });
});

describe('sumStaffGroup', () => {
  it("teachingStaff «Jami ish o'rni» — kafedra mudiri + professor-o'qituvchilar (5 ish o'rni, 1800 soat)", () => {
    const teaching = STAFF_GROUPS[1]!;
    expect(teaching.totalOf).toEqual(['departmentHead', 'teachingStaff']);
    expect(sumStaffGroup(items, {}, teaching, 'positions')).toBe(5);
    expect(sumStaffGroup(items, {}, teaching, 'totalHours')).toBe(1800);
  });

  it("'load' jami — O'RTACHA, butun son: Jami soat ÷ Jami ish o'rni (1800 / 5 = 360), yig'indi (1050) EMAS", () => {
    expect(sumStaffGroup(items, {}, STAFF_GROUPS[1]!, 'load')).toBe(360);
  });

  it("'supportStaff' «Jami ish o'rinlari» — mudir + o'qituvchilar + o'quv yordamchi, faqat ish o'rni qatorida", () => {
    const support = STAFF_GROUPS[2]!;
    expect(support.totalOf).toEqual(['departmentHead', 'teachingStaff', 'supportStaff']);
    expect(support.totalRows).toEqual(['positions']);
    expect(sumStaffGroup(items, {}, support, 'positions')).toBe(5);
    expect(sumStaffGroup(items, {}, support, 'load')).toBe(0);
    expect(sumStaffGroup(items, {}, support, 'totalHours')).toBe(0);
    expect(sumStaffGroup(items, {}, support, 'hourly')).toBe(0);
    const withLab = [...items, { id: 'sp-4', category: 'supportStaff', slug: 'laborant', positions: 3, load: 0, totalHours: 0, hourly: 0 }];
    expect(sumStaffGroup(withLab, {}, support, 'positions')).toBe(8);
    expect(sumStaffGroup(withLab, {}, STAFF_GROUPS[1]!, 'positions')).toBe(5);
    expect(sumStaffGroup(withLab, {}, STAFF_GROUPS[1]!, 'load')).toBe(360);
  });

  it("'hourly' (Soatbay) jami — qo'lda kiritilganlar yig'indisi (40 + 25 = 65), draft hisobga olinadi", () => {
    expect(sumStaffGroup(items, {}, STAFF_GROUPS[1]!, 'hourly')).toBe(65);
    const drafts = { 'teachingStaff:docent': { positions: 2, load: 350, hourly: 10 } };
    expect(sumStaffGroup(items, drafts, STAFF_GROUPS[1]!, 'hourly')).toBe(35);
  });
});

describe('STAFF_GROUPS — ustun tartibi', () => {
  it("teachingStaff'da `trainee` AYNAN `assistant` dan keyin turadi (blanka/PDF tartibi)", () => {
    const slugs = STAFF_GROUPS[1]!.cols.map((c) => c.slug);
    expect(slugs).toEqual(['professor', 'docent', 'seniorTeacher', 'assistant', 'trainee']);
  });
});

describe('buildStaffPositionsPayload', () => {
  it('11 slug HAR DOIM to\'liq yuboriladi — tegilmagan kataklar mavjud/0 qiymat bilan', () => {
    const payload = buildStaffPositionsPayload(items, {});
    expect(payload).toHaveLength(11);
    const prof = payload.find((p) => p.category === 'departmentHead' && p.slug === 'professor');
    expect(prof).toEqual({ id: 'sp-1', category: 'departmentHead', slug: 'professor', positions: 1, load: 300, hourly: 0 });
    const untouched = payload.find((p) => p.category === 'supportStaff' && p.slug === 'laborant');
    expect(untouched).toEqual({ category: 'supportStaff', slug: 'laborant', positions: 0, load: 0, hourly: 0 });
    const trainee = payload.find((p) => p.category === 'teachingStaff' && p.slug === 'trainee');
    expect(trainee).toEqual({ category: 'teachingStaff', slug: 'trainee', positions: 0, load: 0, hourly: 0 });
    const docent = payload.find((p) => p.category === 'teachingStaff' && p.slug === 'docent');
    expect(docent).toEqual({ id: 'sp-2', category: 'teachingStaff', slug: 'docent', positions: 2, load: 350, hourly: 40 });
  });

  it('draft qiymat mavjud bo\'lsa payloadga o\'sha kiradi', () => {
    const drafts = { 'departmentHead:professor': { positions: 3, load: 320, hourly: 0 } };
    const payload = buildStaffPositionsPayload(items, drafts);
    const prof = payload.find((p) => p.category === 'departmentHead' && p.slug === 'professor');
    expect(prof).toEqual({ id: 'sp-1', category: 'departmentHead', slug: 'professor', positions: 3, load: 320, hourly: 0 });
  });

  it('`id` yo\'q (hali saqlanmagan) elementda `id` maydoni umuman yo\'q — {category,slug} upsert', () => {
    const payload = buildStaffPositionsPayload([], {});
    expect(payload).toHaveLength(11);
    for (const item of payload) {
      expect(item).not.toHaveProperty('id');
    }
  });
});
