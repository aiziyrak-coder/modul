import { describe, expect, it } from 'vitest';
import type { ContingentGroup, RowDraft } from './types';
import {
  cohortKey,
  deriveCounts,
  duplicateGroupIds,
  emptyStreamNumbers,
  hasBadStreamNumbers,
  nextStreamNumber,
  rowDraftErrors,
  streamLanguageIds,
  unassignedGroups,
} from './invariants';
import { isInstituteViewer } from './scope';

const g = (id: string, langId: string | null, studentNumber: number, extra: Partial<ContingentGroup> = {}): ContingentGroup => ({
  id,
  title: id.toUpperCase(),
  langId,
  langTitle: '',
  studentNumber,
  inactive: false,
  missing: false,
  ...extra,
});

const pool = [g('g1', 'uz', 25), g('g2', 'uz', 24), g('g3', 'ru', 20), g('g4', 'ru', 18)];
const byId = new Map(pool.map((x) => [x.id, x]));

const draft = (patch: Partial<RowDraft> = {}): RowDraft => ({
  directionId: 'd1',
  courseNum: 1,
  streams: [
    { number: 1, groupIds: ['g1', 'g2'] },
    { number: 2, groupIds: ['g3', 'g4'] },
  ],
  note: '',
  ...patch,
});

describe('department-contingent invariantlari', () => {
  it("to'g'ri qator — xato yo'q", () => {
    expect(rowDraftErrors(draft(), [])).toEqual([]);
  });

  it('guruh ikki oqimda — invariant #1', () => {
    const streams = [
      { number: 1, groupIds: ['g1', 'g2'] },
      { number: 2, groupIds: ['g2', 'g3'] },
    ];
    expect(duplicateGroupIds(streams)).toEqual(['g2']);
    expect(rowDraftErrors(draft({ streams }), [])).toContain('studyLoad.deptContingent.invariant.groupInTwoStreams');
  });

  it("bo'sh oqim va oqimsiz qator", () => {
    const streams = [
      { number: 1, groupIds: ['g1'] },
      { number: 2, groupIds: [] },
    ];
    expect(emptyStreamNumbers(streams)).toEqual([2]);
    expect(rowDraftErrors(draft({ streams }), [])).toEqual(['studyLoad.deptContingent.invariant.emptyStream']);
    expect(rowDraftErrors(draft({ streams: [] }), [])).toEqual(['studyLoad.deptContingent.invariant.noStreams']);
  });

  it("takror (yo'nalish, kurs) — boshqa qatorlar kalitlariga qarab; o'zi hisobga olinmaydi", () => {
    expect(rowDraftErrors(draft(), [cohortKey('d1', 1)])).toEqual(['studyLoad.deptContingent.invariant.duplicateRow']);
    expect(rowDraftErrors(draft(), [cohortKey('d1', 2), cohortKey('d2', 1)])).toEqual([]);
  });

  it("yo'nalish tanlanmagan", () => {
    expect(rowDraftErrors(draft({ directionId: '' }), [cohortKey('', 1)])).toEqual([
      'studyLoad.deptContingent.invariant.noDirection',
    ]);
  });

  it('oqim raqami: takror, 0, 50 dan katta, kasr — xato', () => {
    expect(hasBadStreamNumbers([{ number: 1, groupIds: [] }, { number: 1, groupIds: [] }])).toBe(true);
    expect(hasBadStreamNumbers([{ number: 0, groupIds: [] }])).toBe(true);
    expect(hasBadStreamNumbers([{ number: 51, groupIds: [] }])).toBe(true);
    expect(hasBadStreamNumbers([{ number: 1.5, groupIds: [] }])).toBe(true);
    expect(hasBadStreamNumbers([{ number: 1, groupIds: [] }, { number: 3, groupIds: [] }])).toBe(false);
    const streams = [
      { number: 2, groupIds: ['g1'] },
      { number: 2, groupIds: ['g3'] },
    ];
    expect(rowDraftErrors(draft({ streams }), [])).toEqual(['studyLoad.deptContingent.invariant.streamNumber']);
  });

  it("jonli sonlar — backend rowDerived: takror guruh bir marta, bo'sh oqim sanalmaydi", () => {
    expect(deriveCounts(draft().streams, byId)).toEqual({ groupCount: 4, studentCount: 87, streamCount: 2 });
    expect(
      deriveCounts(
        [
          { number: 1, groupIds: ['g1', 'g1'] },
          { number: 2, groupIds: [] },
          { number: 3, groupIds: ['gX'] },
        ],
        byId,
      ),
    ).toEqual({ groupCount: 2, studentCount: 25, streamCount: 2 });
  });

  it('oqim tillari — guruhlardan hosila, aralash til aniqlanadi', () => {
    expect(streamLanguageIds({ number: 1, groupIds: ['g1', 'g2'] }, byId)).toEqual(['uz']);
    expect(streamLanguageIds({ number: 1, groupIds: ['g1', 'g3'] }, byId).sort()).toEqual(['ru', 'uz']);
  });

  it("oqimga kiritilmagan faol guruhlar (faol emas / topilmaganlar hisobga olinmaydi)", () => {
    const withInactive = [...pool, g('g5', 'uz', 10, { inactive: true })];
    expect(unassignedGroups(withInactive, [{ number: 1, groupIds: ['g1', 'g3'] }]).map((x) => x.id)).toEqual(['g2', 'g4']);
    expect(unassignedGroups(pool, draft().streams)).toEqual([]);
  });

  it('keyingi oqim raqami = max + 1', () => {
    expect(nextStreamNumber([])).toBe(1);
    expect(nextStreamNumber([{ number: 1, groupIds: [] }, { number: 4, groupIds: [] }])).toBe(5);
  });
});

describe('department-contingent scope (UI)', () => {
  it("kafedra mudiri yig'ma/kafedra filtrini ko'rmaydi; O'UB va super ko'radi", () => {
    expect(isInstituteViewer('kafedra_mudiri', false)).toBe(false);
    expect(isInstituteViewer('oquv_uslubiy_boshqarma', false)).toBe(true);
    expect(isInstituteViewer('kafedra_mudiri', true)).toBe(true);
  });
});
