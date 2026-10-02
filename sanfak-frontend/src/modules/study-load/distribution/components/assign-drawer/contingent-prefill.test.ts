import { describe, expect, it } from 'vitest';
import type {
  ContingentGroup,
  DeptContingentListItem,
  DeptContingentRow,
} from '../../../department-contingent/model/types';
import {
  buildContingentPrefill,
  detectCountMismatch,
  findContingentRow,
  pickContingentId,
  streamLanguage,
  unionGroupIds,
} from './contingent-prefill';

const g = (id: string, langId: string | null = 'uz', extra: Partial<ContingentGroup> = {}): ContingentGroup => ({
  id,
  title: id,
  langId,
  langTitle: '',
  studentNumber: 25,
  inactive: false,
  missing: false,
  ...extra,
});

const row = (over: Partial<DeptContingentRow> = {}): DeptContingentRow => ({
  key: 'r1',
  directionId: 'd1',
  directionTitle: 'Davolash ishi',
  directionCode: '',
  courseNum: 2,
  streams: [
    { number: 1, groups: [g('g1'), g('g2')], languageIds: ['uz'] },
    { number: 2, groups: [g('g3', 'ru'), g('g4', 'ru')], languageIds: ['ru'] },
  ],
  note: null,
  derived: { groupCount: 4, studentCount: 100, streamCount: 2 },
  problems: [],
  ...over,
});

const block = { directionId: 'd1', course: 2, streamCount: 2, groupCount: 4 };

describe('findContingentRow', () => {
  it("yo'nalish + kurs bo'yicha topadi", () => {
    const rows = [row({ key: 'a', courseNum: 1 }), row({ key: 'b' }), row({ key: 'c', directionId: 'd2' })];
    expect(findContingentRow(rows, block)?.key).toBe('b');
  });

  it("mos qator yo'q yoki blokda yo'nalish/kurs noma'lum — null", () => {
    expect(findContingentRow([row({ courseNum: 3 })], block)).toBeNull();
    expect(findContingentRow([row()], { directionId: null, course: 2 })).toBeNull();
    expect(findContingentRow([row()], { directionId: 'd1', course: 0 })).toBeNull();
  });
});

describe('pickContingentId', () => {
  const item = (id: string, dep: string | null, ay: string | null): DeptContingentListItem => ({
    id,
    departmentId: dep,
    departmentTitle: '',
    academicYearId: ay,
    academicYearTitle: '',
    rowCount: 1,
    streamCount: 1,
    updatedAt: null,
  });

  it("kafedra + yil bo'yicha tanlaydi", () => {
    const items = [item('x', 'dep2', 'ay1'), item('y', 'dep1', 'ay2'), item('z', 'dep1', 'ay1')];
    expect(pickContingentId(items, 'dep1', 'ay1')).toBe('z');
    expect(pickContingentId(items, 'dep3', 'ay1')).toBeNull();
  });

  it("kafedra noma'lum — faqat yagona hujjat olinadi", () => {
    expect(pickContingentId([item('x', 'dep1', 'ay1')], null, 'ay1')).toBe('x');
    expect(pickContingentId([item('x', 'dep1', 'ay1'), item('y', 'dep2', 'ay1')], null, 'ay1')).toBeNull();
    expect(pickContingentId([], 'dep1', 'ay1')).toBeNull();
  });
});

describe('unionGroupIds (K3c)', () => {
  it('oqimlar guruhlari birlashmasi — tartib saqlanadi, takror yo\'q', () => {
    expect(
      unionGroupIds([
        { number: 1, groups: ['g1', 'g2'] },
        { number: 2, groups: ['g2', 'g3'] },
      ]),
    ).toEqual(['g1', 'g2', 'g3']);
    expect(unionGroupIds([])).toEqual([]);
  });
});

describe('detectCountMismatch (K3b)', () => {
  const derived = { groupCount: 4, studentCount: 100, streamCount: 2 };

  it("mos — bo'sh ro'yxat", () => {
    expect(detectCountMismatch(derived, { streamCount: 2, groupCount: 4 })).toEqual([]);
  });

  it('oqim va guruh soni farqi alohida qaytadi', () => {
    expect(detectCountMismatch(derived, { streamCount: 3, groupCount: 5 })).toEqual([
      { field: 'stream', contingent: 2, workload: 3 },
      { field: 'group', contingent: 4, workload: 5 },
    ]);
  });

  it("blokda son yo'q (null) — solishtirilmaydi", () => {
    expect(detectCountMismatch(derived, { streamCount: null, groupCount: null })).toEqual([]);
  });
});

describe('streamLanguage', () => {
  it('bitta til — shu id; aralash — null; languageIds bo\'sh bo\'lsa guruhlardan', () => {
    expect(streamLanguage({ number: 1, groups: [], languageIds: ['uz'] })).toBe('uz');
    expect(streamLanguage({ number: 1, groups: [], languageIds: ['uz', 'ru'] })).toBeNull();
    expect(streamLanguage({ number: 1, groups: [g('a', 'ru'), g('b', 'ru')], languageIds: [] })).toBe('ru');
    expect(streamLanguage({ number: 1, groups: [g('a', null)], languageIds: [] })).toBeNull();
  });
});

describe('buildContingentPrefill', () => {
  it('topildi: oqimlar (raqam, guruhlar, til) + groups = birlashma, farq yo\'q', () => {
    expect(buildContingentPrefill([row()], block, null)).toEqual({
      kind: 'found',
      streams: [
        { number: 1, groups: ['g1', 'g2'], language: 'uz' },
        { number: 2, groups: ['g3', 'g4'], language: 'ru' },
      ],
      groups: ['g1', 'g2', 'g3', 'g4'],
      droppedGroups: 0,
      mismatches: [],
    });
  });

  it("qator yo'q — noRow", () => {
    expect(buildContingentPrefill([row({ directionId: 'd9' })], block, null)).toEqual({ kind: 'noRow' });
    expect(buildContingentPrefill([], block, null)).toEqual({ kind: 'noRow' });
  });

  it("mavjud bo'lmagan / o'chgan guruh tashlanadi, bo'sh oqim olib tashlanadi", () => {
    const r = row({
      streams: [
        { number: 1, groups: [g('g1'), g('gx', 'uz', { missing: true })], languageIds: ['uz'] },
        { number: 2, groups: [g('g3', 'ru')], languageIds: ['ru'] },
      ],
    });
    const res = buildContingentPrefill([r], block, new Set(['g1', 'gx']));
    expect(res).toMatchObject({
      kind: 'found',
      streams: [{ number: 1, groups: ['g1'], language: 'uz' }],
      groups: ['g1'],
      droppedGroups: 2,
    });
  });

  it('son farqi bo\'lsa ham natija qaytadi (qo\'llash foydalanuvchida)', () => {
    const res = buildContingentPrefill([row()], { ...block, streamCount: 3 }, null);
    expect(res.kind).toBe('found');
    if (res.kind === 'found') {
      expect(res.streams).toHaveLength(2);
      expect(res.mismatches).toEqual([{ field: 'stream', contingent: 2, workload: 3 }]);
    }
  });
});
