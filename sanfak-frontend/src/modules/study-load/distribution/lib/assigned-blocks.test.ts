import { describe, expect, it } from 'vitest';
import { buildAssignedBlockMap, isGroupTakenFor } from './assigned-blocks';
import type { DistributionBlock, DistributionTeacher } from '../model/types';

function block(partial: Partial<DistributionBlock>): DistributionBlock {
  return {
    id: 'b1',
    scienceId: null,
    scienceName: null,
    course: 1,
    semester: 1,
    groupCount: 0,
    streamCount: 0,
    studentCount: 0,
    semTotalHour: 0,
    auditoriumHour: 0,
    classTypes: [],
    studyWorkItems: [],
    totalHour: 0,
    workloadBlockId: null,
    groupIds: [],
    suitability: 'unknown',
    justification: { basis: null, note: null, declaredBy: null, declaredAt: null },
    classTypeSlugs: [],
    ...partial,
  };
}

function teacher(partial: Partial<DistributionTeacher>): DistributionTeacher {
  return {
    id: 't1',
    fullName: 'Aliyev A.',
    stavka: 1,
    position: null,
    isVacant: false,
    vacantLabel: null,
    blocks: [],
    totalHour: 0,
    acceptanceStatus: 'pending',
    ...partial,
  } as DistributionTeacher;
}

describe('buildAssignedBlockMap', () => {
  it('bo`sh kirish — bo`sh xarita', () => {
    expect(buildAssignedBlockMap(undefined).size).toBe(0);
    expect(buildAssignedBlockMap([]).size).toBe(0);
  });

  it('band guruhlarni BIR NECHTA o`qituvchi bo`ylab yig`adi', () => {
    const map = buildAssignedBlockMap([
      teacher({
        id: 't1',
        fullName: 'Aliyev A.',
        blocks: [block({ workloadBlockId: 'wb1', groupIds: ['g1', 'g2'] })],
      }),
      teacher({
        id: 't2',
        fullName: 'Valiyev V.',
        blocks: [block({ id: 'b2', workloadBlockId: 'wb1', groupIds: ['g3'] })],
      }),
    ]);

    const info = map.get('wb1');
    expect(info?.takenGroupIds).toEqual(['g1', 'g2', 'g3']);
    expect(info?.teacherNames).toEqual(['Aliyev A.', 'Valiyev V.']);
  });

  it('takroriy guruh va ism ikki marta yozilmaydi', () => {
    const map = buildAssignedBlockMap([
      teacher({
        fullName: 'Aliyev A.',
        blocks: [
          block({ workloadBlockId: 'wb1', groupIds: ['g1'] }),
          block({ id: 'b2', workloadBlockId: 'wb1', groupIds: ['g1', 'g2'] }),
        ],
      }),
    ]);

    expect(map.get('wb1')?.takenGroupIds).toEqual(['g1', 'g2']);
    expect(map.get('wb1')?.teacherNames).toEqual(['Aliyev A.']);
  });

  it('`workloadBlockId` yo`q ESKI yozuv e`tiborsiz qoldiriladi', () => {
    const map = buildAssignedBlockMap([
      teacher({ blocks: [block({ workloadBlockId: null, groupIds: ['g1'] })] }),
    ]);
    expect(map.size).toBe(0);
  });

  it('vakant yozuv o`z yorlig`i bilan chiqadi', () => {
    const map = buildAssignedBlockMap([
      teacher({
        isVacant: true,
        vacantLabel: 'Vakant #2',
        fullName: '',
        blocks: [block({ workloadBlockId: 'wb1', groupIds: [] })],
      }),
    ]);
    expect(map.get('wb1')?.teacherNames).toEqual(['Vakant #2']);
  });
});

describe('buildAssignedBlockMap — takenTypesByGroup / isGroupTakenFor (ADR-034)', () => {
  it("ma'ruzasi biriktirilgan guruh amaliy uchun BO'SH; bo'linmagan blok ([]) hamma turni band qiladi", () => {
    const map = buildAssignedBlockMap([
      teacher({
        id: 'tA',
        blocks: [block({ workloadBlockId: 'wb1', groupIds: ['g1', 'g2'], classTypeSlugs: ['maruza'] })],
      }),
      teacher({
        id: 'tB',
        blocks: [block({ workloadBlockId: 'wb1', groupIds: ['g3'], classTypeSlugs: [] })],
      }),
    ]);
    const info = map.get('wb1');
    expect(info?.takenGroupIds).toEqual(['g1', 'g2', 'g3']);
    expect(info?.takenTypesByGroup).toEqual({ g1: ['maruza'], g2: ['maruza'], g3: [] });
    expect(isGroupTakenFor(info, 'g1', ['amaliy'])).toBe(false);
    expect(isGroupTakenFor(info, 'g1', ['maruza'])).toBe(true);
    expect(isGroupTakenFor(info, 'g1', [])).toBe(true);
    expect(isGroupTakenFor(info, 'g3', ['amaliy'])).toBe(true);
    expect(isGroupTakenFor(info, 'g9', ['amaliy'])).toBe(false);
    expect(isGroupTakenFor(undefined, 'g1', ['amaliy'])).toBe(false);
  });

  it('mudofaa: `classTypeSlugs` maydonsiz blok (eski kesh) — hamma tur deb olinadi, crash yo`q', () => {
    const legacy = block({ workloadBlockId: 'wb1', groupIds: ['g1'] });
    delete (legacy as Partial<DistributionBlock>).classTypeSlugs;
    const map = buildAssignedBlockMap([teacher({ id: 'tA', blocks: [legacy] })]);
    expect(map.get('wb1')?.takenTypesByGroup).toEqual({ g1: [] });
    expect(isGroupTakenFor(map.get('wb1'), 'g1', ['amaliy'])).toBe(true);
  });

  it("bir guruhda turlar birlashadi; keyin [] kelsa — hamma tur (yutadi)", () => {
    const map = buildAssignedBlockMap([
      teacher({ id: 'tA', blocks: [block({ workloadBlockId: 'wb1', groupIds: ['g1'], classTypeSlugs: ['maruza'] })] }),
      teacher({ id: 'tB', blocks: [block({ workloadBlockId: 'wb1', groupIds: ['g1'], classTypeSlugs: ['seminar'] })] }),
    ]);
    expect(map.get('wb1')?.takenTypesByGroup.g1).toEqual(['maruza', 'seminar']);
    expect(isGroupTakenFor(map.get('wb1'), 'g1', ['amaliy'])).toBe(false);
    const full = buildAssignedBlockMap([
      teacher({ id: 'tA', blocks: [block({ workloadBlockId: 'wb1', groupIds: ['g1'], classTypeSlugs: ['maruza'] })] }),
      teacher({ id: 'tB', blocks: [block({ workloadBlockId: 'wb1', groupIds: ['g1'], classTypeSlugs: [] })] }),
    ]);
    expect(full.get('wb1')?.takenTypesByGroup.g1).toEqual([]);
  });
});
