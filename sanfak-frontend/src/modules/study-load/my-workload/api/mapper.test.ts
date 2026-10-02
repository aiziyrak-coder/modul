import { describe, expect, it } from 'vitest';
import { flattenToRows, mapMyDistribution } from './mapper';
import type { BackendMyDistribution } from './mapper';
import type { MyWorkload } from '../model/types';

describe('flattenToRows', () => {
  it('rejectionReason va respondedAt har blok qatoriga o\'tkaziladi (rejected entry)', () => {
    const distributions: MyWorkload[] = [
      {
        id: 'd1',
        academicYearTitle: '2025-2026',
        course: 1,
        totalHour: 400,
        status: 'in_review',
        date: '2026-01-01',
        myEntries: [
          {
            teacherEntryId: 'e1',
            acceptanceStatus: 'rejected',
            stavka: 1,
            totalHour: 400,
            rejectionReason: 'Soatlar noto\'g\'ri taqsimlangan',
            respondedAt: '2026-01-05T00:00:00.000Z',
            blocks: [
              {
                blockId: 'b1',
                scienceName: 'Anatomiya',
                classTypeSlugs: [],
                course: 1,
                semester: 1,
                totalHour: 200,
                type: 'lecture',
                acceptanceStatus: 'rejected',
                rejectionReason: 'Soatlar noto\'g\'ri taqsimlangan',
                respondedAt: '2026-01-05T00:00:00.000Z',
              },
            ],
          },
        ],
      },
    ];

    const rows = flattenToRows(distributions);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      blockId: 'b1',
      acceptanceStatus: 'rejected',
      rejectionReason: 'Soatlar noto\'g\'ri taqsimlangan',
      scienceName: 'Anatomiya',
    });
  });

  it('bloksiz entry (bo\'sh qator) uchun ham rejectionReason o\'tkaziladi, blockId=null', () => {
    const distributions: MyWorkload[] = [
      {
        id: 'd2',
        academicYearTitle: null,
        course: 2,
        totalHour: 100,
        status: 'in_review',
        date: null,
        myEntries: [
          {
            teacherEntryId: 'e2',
            acceptanceStatus: 'rejected',
            stavka: 0.5,
            totalHour: 100,
            rejectionReason: 'Stavka mos emas',
            respondedAt: null,
            blocks: [],
          },
        ],
      },
    ];

    const rows = flattenToRows(distributions);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.rejectionReason).toBe('Stavka mos emas');
    expect(rows[0]?.scienceName).toBeNull();
    expect(rows[0]?.blockId).toBeNull();
  });

  it('accepted entryda rejectionReason null', () => {
    const distributions: MyWorkload[] = [
      {
        id: 'd3',
        academicYearTitle: '2025-2026',
        course: 1,
        totalHour: 200,
        status: 'approved',
        date: '2026-01-01',
        myEntries: [
          {
            teacherEntryId: 'e3',
            acceptanceStatus: 'accepted',
            stavka: 1,
            totalHour: 200,
            rejectionReason: null,
            respondedAt: '2026-01-02T00:00:00.000Z',
            blocks: [
              {
                blockId: 'b3',
                scienceName: 'Fiziologiya',
                classTypeSlugs: [],
                course: 1,
                semester: 2,
                totalHour: 200,
                type: 'lab',
                acceptanceStatus: 'accepted',
                rejectionReason: null,
                respondedAt: '2026-01-02T00:00:00.000Z',
              },
            ],
          },
        ],
      },
    ];

    const rows = flattenToRows(distributions);

    expect(rows[0]?.rejectionReason).toBeNull();
  });

  it('ASOSIY DEFEKT REGRESSIYASI: 1 entry + 2 blok (biri accepted, biri pending) → ikki xil statusli qator', () => {
    const distributions: MyWorkload[] = [
      {
        id: 'd4',
        academicYearTitle: '2025-2026',
        course: 1,
        totalHour: 400,
        status: 'in_review',
        date: '2026-01-01',
        myEntries: [
          {
            teacherEntryId: 'e4',
            acceptanceStatus: 'pending',
            stavka: 1,
            totalHour: 400,
            rejectionReason: null,
            respondedAt: null,
            blocks: [
              {
                blockId: 'b4-1',
                scienceName: 'Anatomiya',
                classTypeSlugs: [],
                course: 1,
                semester: 1,
                totalHour: 200,
                type: 'lecture',
                acceptanceStatus: 'accepted',
                rejectionReason: null,
                respondedAt: '2026-01-05T00:00:00.000Z',
              },
              {
                blockId: 'b4-2',
                scienceName: 'Fiziologiya',
                classTypeSlugs: [],
                course: 1,
                semester: 2,
                totalHour: 200,
                type: 'lab',
                acceptanceStatus: 'pending',
                rejectionReason: null,
                respondedAt: null,
              },
            ],
          },
        ],
      },
    ];

    const rows = flattenToRows(distributions);

    expect(rows).toHaveLength(2);
    const accepted = rows.find((r) => r.blockId === 'b4-1');
    const pending = rows.find((r) => r.blockId === 'b4-2');
    expect(accepted?.acceptanceStatus).toBe('accepted');
    expect(pending?.acceptanceStatus).toBe('pending');
    expect(accepted?.entryAcceptanceStatus).toBe('pending');
    expect(pending?.entryAcceptanceStatus).toBe('pending');
  });

  it('rowKey blockId ga asoslangan — bloklar qayta tartiblansa ham barqaror', () => {
    const makeDist = (blocks: MyWorkload['myEntries'][number]['blocks']): MyWorkload[] => [
      {
        id: 'd5',
        academicYearTitle: null,
        course: 1,
        totalHour: 400,
        status: 'in_review',
        date: null,
        myEntries: [
          {
            teacherEntryId: 'e5',
            acceptanceStatus: 'pending',
            stavka: 1,
            totalHour: 400,
            rejectionReason: null,
            respondedAt: null,
            blocks,
          },
        ],
      },
    ];

    const blockA = {
      blockId: 'bA',
      scienceName: 'A',
      classTypeSlugs: [],
      course: 1,
      semester: 1,
      totalHour: 100,
      type: 'lecture',
      acceptanceStatus: 'pending' as const,
      rejectionReason: null,
      respondedAt: null,
    };
    const blockB = {
      blockId: 'bB',
      scienceName: 'B',
      classTypeSlugs: [],
      course: 1,
      semester: 1,
      totalHour: 100,
      type: 'lecture',
      acceptanceStatus: 'pending' as const,
      rejectionReason: null,
      respondedAt: null,
    };

    const rowsOrder1 = flattenToRows(makeDist([blockA, blockB]));
    const rowsOrder2 = flattenToRows(makeDist([blockB, blockA]));

    const keysOrder1 = new Set(rowsOrder1.map((r) => r.rowKey));
    const keysOrder2 = new Set(rowsOrder2.map((r) => r.rowKey));
    expect(keysOrder1).toEqual(keysOrder2);
  });

  it('legacy javob (blokda acceptanceStatus yo\'q) → yiqilmaydi, mapEntry statusiga tushadi', () => {
    const backendDoc: BackendMyDistribution = {
      _id: 'd6',
      academicYear: null,
      course: 1,
      totalHour: 200,
      status: 'in_review',
      date: null,
      myEntries: [
        {
          teacherEntryId: 'e6',
          acceptanceStatus: 'accepted',
          rejectionReason: null,
          respondedAt: '2026-01-02T00:00:00.000Z',
          stavka: 1,
          totalHour: 200,
          blocks: [
            {
              science: { _id: 's1', title: 'Kimyo' },
              course: 1,
              semester: 1,
              totalHour: 200,
              type: 'lecture',
            },
          ],
        },
      ],
    };

    const mapped = mapMyDistribution(backendDoc);
    const rows = flattenToRows([mapped]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.acceptanceStatus).toBe('accepted');
    expect(rows[0]?.rejectionReason).toBeNull();
    expect(rows[0]?.blockId).toBeNull();
  });
});

describe('my-workload mapper — classTypeSlugs (ADR-034)', () => {
  it("bo'lingan blokda slug'lar, eski blokda [] — qatorlarga ham o'tadi", () => {
    const rows = flattenToRows([
      mapMyDistribution({
          _id: 'd1',
          course: 2,
          totalHour: 31,
          status: 'draft',
          myEntries: [
            {
              teacherEntryId: 'e1',
              acceptanceStatus: 'pending',
              stavka: 1,
              totalHour: 17,
              blocks: [
                { blockId: 'b1', science: { _id: 's1', title: 'Anatomiya' }, course: 2, semester: 1, totalHour: 17, type: 'lesson', classTypeSlugs: ['maruza'] },
                { blockId: 'b2', science: { _id: 's1', title: 'Anatomiya' }, course: 2, semester: 1, totalHour: 31, type: 'lesson' },
              ],
            },
          ],
      } as unknown as BackendMyDistribution),
    ]);
    expect(rows.map((r) => r.classTypeSlugs)).toEqual([['maruza'], []]);
  });
});

describe('my-workload mapper — superseded (ADR-043)', () => {
  const base = {
    course: 1,
    totalHour: 10,
    myEntries: [
      {
        teacherEntryId: 'e1',
        acceptanceStatus: 'pending',
        blocks: [{ blockId: 'b1', course: 1, semester: 1, totalHour: 10, acceptanceStatus: 'pending' }],
      },
    ],
  };

  it("`superseded: true` → taqsimot va qatorlar belgilanadi", () => {
    const dist = mapMyDistribution({
      _id: 'd1',
      status: 'superseded',
      superseded: true,
      supersededAt: '2026-09-24T00:00:00.000Z',
      ...base,
    } as BackendMyDistribution);
    expect(dist.superseded).toBe(true);
    expect(flattenToRows([dist]).every((r) => r.superseded)).toBe(true);
  });

  it("bayroq yo'q, lekin status superseded → baribir true; oddiy taqsimot → false", () => {
    expect(mapMyDistribution({ _id: 'd1', status: 'superseded' }).superseded).toBe(true);
    const active = mapMyDistribution({ _id: 'd2', status: 'approved', ...base } as BackendMyDistribution);
    expect(active.superseded).toBe(false);
    expect(flattenToRows([active])[0]?.superseded).toBe(false);
  });
});
