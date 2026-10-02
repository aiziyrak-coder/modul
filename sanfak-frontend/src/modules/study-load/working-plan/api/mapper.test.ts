import { describe, expect, it } from 'vitest';
import {
  mapElectiveUsageInfo,
  mapWorkingPlanDetail,
  type BackendScience,
  type BackendWorkingPlanDetail,
} from './mapper';

function detail(sciences: BackendScience[]): BackendWorkingPlanDetail {
  return {
    _id: 'wp-1',
    createdAt: '2026-09-01T00:00:00.000Z',
    semesters: {
      '1': { semester: '1', blocks: [{ _id: 'blk-1', blockCode: 'MFI', sciences }] },
    },
  };
}

describe('mapWorkingPlanDetail — rowType', () => {
  it('backend qiymatlarini o`zgarishsiz oladi (subject / sectionHeader / aggregate)', () => {
    const mapped = mapWorkingPlanDetail(
      detail([
        { _id: 's-1', title: 'Anatomiya', rowType: 'subject' },
        { _id: 's-2', title: 'Klinika oldi fanlari moduli', rowType: 'sectionHeader' },
        { _id: 's-3', title: 'Jami', rowType: 'aggregate' },
      ]),
    );

    const rows = mapped.semesters['1']!.blocks[0]!.sciences;
    expect(rows.map((s) => s.rowType)).toEqual(['subject', 'sectionHeader', 'aggregate']);
  });

  it('maydon YO`Q yoki noma`lum bo`lsa — `subject` (eski hujjat xulqi saqlanadi)', () => {
    const mapped = mapWorkingPlanDetail(
      detail([
        { _id: 's-1', title: 'Anatomiya' },
        { _id: 's-2', title: 'Gistologiya', rowType: null },
        { _id: 's-3', title: 'Fiziologiya', rowType: 'kelajakdagiTur' },
      ]),
    );

    const rows = mapped.semesters['1']!.blocks[0]!.sciences;
    expect(rows.map((s) => s.rowType)).toEqual(['subject', 'subject', 'subject']);
  });
});

describe('mapWorkingPlanDetail — semesterNumbers', () => {
  const two = (): BackendWorkingPlanDetail => ({
    _id: 'wp-1',
    createdAt: '2026-09-01T00:00:00.000Z',
    semesters: {
      '1': { semester: '1', blocks: [] },
      '2': { semester: '2', blocks: [] },
    },
  });

  it('backend bergan global raqamni oladi (III bosqich: 1→5, 2→6), kalitlar o`zgarmaydi', () => {
    const mapped = mapWorkingPlanDetail({ ...two(), semesterNumbers: { '1': '5', '2': '6' } });
    expect(mapped.semesterNumbers).toEqual({ '1': '5', '2': '6' });
    expect(Object.keys(mapped.semesters)).toEqual(['1', '2']);
  });

  it('maydon YO`Q (eski backend) — lokal kalitning o`zi, bo`sh sarlavha yo`q', () => {
    const mapped = mapWorkingPlanDetail(two());
    expect(mapped.semesterNumbers).toEqual({ '1': '1', '2': '2' });
  });

  it('qisman kelsa — yetishmagan kalit lokalga tushadi', () => {
    const mapped = mapWorkingPlanDetail({ ...two(), semesterNumbers: { '1': '5' } });
    expect(mapped.semesterNumbers).toEqual({ '1': '5', '2': '2' });
  });
});

describe('mapWorkingPlanDetail — electiveSlot va unfilledSlots (ADR-032)', () => {
  it('`electiveSlot` rowType o`zgarishsiz o`tadi', () => {
    const mapped = mapWorkingPlanDetail(
      detail([{ _id: 's-1', title: 'Tanlov fani (tanlanmagan)', rowType: 'electiveSlot' }]),
    );
    expect(mapped.semesters['1']!.blocks[0]!.sciences[0]!.rowType).toBe('electiveSlot');
  });

  it('`unfilledSlots` maydonga xaritalanadi; yo`q bo`lsa bo`sh massiv', () => {
    const base = detail([]);
    expect(mapWorkingPlanDetail(base).unfilledSlots).toEqual([]);
    const mapped = mapWorkingPlanDetail({
      ...base,
      unfilledSlots: [{ semKey: '1', blockId: 'blk', rowId: 'slot-1', serialNumber: '2.01', credit: 5, hour: 5 }],
    });
    expect(mapped.unfilledSlots).toEqual([
      { semKey: '1', blockId: 'blk', rowId: 'slot-1', serialNumber: '2.01', credit: 5, hour: 5 },
    ]);
  });
});

describe('mapElectiveUsageInfo — qamrov (test4 QA F-09)', () => {
  it('`lockedWorkingPlans` xaritalanadi; eski backend (maydon yo`q) — 0', () => {
    const base = { elective: true, locked: false, status: 'draft', studyPlan: 'sp-1', canSwap: true };
    expect(mapElectiveUsageInfo({ ...base, affectedWorkingPlans: 1, lockedWorkingPlans: 2 })).toMatchObject({
      affectedWorkingPlans: 1,
      lockedWorkingPlans: 2,
    });
    expect(mapElectiveUsageInfo(base)).toMatchObject({ affectedWorkingPlans: 0, lockedWorkingPlans: 0 });
  });
});
