import { describe, expect, it } from 'vitest';
import {
  mapContingentReport,
  mapContingentReportDetail,
  mapPrefillMeta,
  mapSummary,
  toRowInput,
  type BackendContingentReport,
} from './mapper';

const backend: BackendContingentReport = {
  _id: 'r1',
  faculty: { _id: 'f1', title: 'Davolash ishi fakulteti' },
  facultyTitle: 'ESKI NOM',
  academicYear: 'ay1',
  academicYearTitle: '2026/2027',
  status: 'in_review',
  asOfDate: '2026-09-22T00:00:00.000Z',
  submittedAt: '2026-09-22T05:00:00.000Z',
  rows: [
    {
      direction: 'd1',
      directionCode: '60910200',
      directionTitle: 'Davolash ishi',
      category: 'milliy',
      course: 1,
      total: 61,
      boys: 30,
      girls: 31,
      groupCount: 3,
      streamCount: 2,
      source: { total: 'groups', groupCount: 'groups', streamCount: 'manual' },
    },
    { direction: { _id: 'd2', title: 'Farmatsiya' }, category: 'nimadir', course: 2, total: null },
  ],
  foreignByCountry: [{ country: 'Hindiston', total: 3, boys: 2, girls: 1 }],
  approvalSteps: [{ step: 'dean', status: 'pending' }],
  currentStep: 'dean',
};

describe('contingent-report mapper', () => {
  it("ro'yxat: id, populate title ustuvor, currentStep faqat in_review", () => {
    const r = mapContingentReport(backend);
    expect(r).toMatchObject({
      id: 'r1',
      facultyId: 'f1',
      facultyTitle: 'Davolash ishi fakulteti',
      academicYearId: 'ay1',
      academicYearTitle: '2026/2027',
      status: 'in_review',
      currentStep: 'dean',
      submittedAt: '2026-09-22T05:00:00.000Z',
    });
    expect(mapContingentReport({ ...backend, status: 'draft' }).currentStep).toBeNull();
    expect(mapContingentReport({ ...backend, currentStep: undefined }).currentStep).toBe('dean');
  });

  it('detal: qatorlar (raqam default 0, toifa/manba enum), davlatlar, zanjir', () => {
    const d = mapContingentReportDetail(backend);
    expect(d.rows).toHaveLength(2);
    expect(d.rows[0]).toMatchObject({
      directionId: 'd1',
      directionCode: '60910200',
      directionTitle: 'Davolash ishi',
      category: 'milliy',
      course: 1,
      total: 61,
      grant: 0,
      mobilityIn: 0,
      source: { total: 'groups', groupCount: 'groups', streamCount: 'manual' },
    });
    expect(d.rows[1]).toMatchObject({
      directionId: 'd2',
      directionTitle: 'Farmatsiya',
      category: 'milliy',
      total: 0,
      source: { total: 'manual', groupCount: 'manual', streamCount: 'manual' },
    });
    expect(d.foreignByCountry).toEqual([{ country: 'Hindiston', total: 3, boys: 2, girls: 1 }]);
    expect(d.approvalHistory).toHaveLength(1);
    expect(d.rejectComment).toBeNull();
  });

  it("rad etilgan izoh — oxirgi `rejected` bosqichdan", () => {
    const d = mapContingentReportDetail({
      ...backend,
      status: 'rejected',
      approvalSteps: [{ step: 'dean', status: 'rejected', comment: 'Raqamlar mos emas' }],
    });
    expect(d.rejectComment).toBe('Raqamlar mos emas');
  });

  it("toRowInput — `source` YUBORILMAYDI, `direction` id", () => {
    const d = mapContingentReportDetail(backend);
    const input = toRowInput(d.rows[0]!);
    expect(input).toMatchObject({ direction: 'd1', course: 1, total: 61, boys: 30 });
    expect('source' in input).toBe(false);
    expect('directionId' in input).toBe(false);
  });

  it('prefill meta — default 0, ixtiyoriylar undefined', () => {
    expect(mapPrefillMeta({ groupsWithoutYear: 2, updated: 3 })).toEqual({
      directionCount: 0,
      groupsCounted: 0,
      groupsWithoutYear: 2,
      unresolvedCourse: 0,
      updated: 3,
      added: undefined,
      skippedManual: undefined,
    });
    expect(mapPrefillMeta(undefined).groupsWithoutYear).toBe(0);
  });

  it("yig'ma — bo'sh javobda ham shakl to'liq, throw yo'q", () => {
    const s = mapSummary({});
    expect(s.facultyBlocks).toEqual([]);
    expect(s.grandTotal.total).toBe(0);
    expect(s.byCourse.rows).toEqual([]);
    expect(s.countries.total).toEqual({ total: 0, boys: 0, girls: 0 });
    expect(s.pendingFaculties).toEqual([]);
  });

  it("yig'ma — bloklar, kurs qatorlari, fakultet×kurs, davlatlar", () => {
    const s = mapSummary({
      academicYearTitle: '2026/2027',
      approvedCount: 1,
      summary: {
        facultyBlocks: [
          {
            facultyId: 'f1',
            facultyTitle: 'Davolash ishi fakulteti',
            facultyShort: 'Davolash ishi',
            directions: [{ key: 'd1|milliy', label: '60910200-Davolash ishi (milliy)', category: 'milliy', rows: [{ course: 1, total: 61 }], total: { total: 61 } }],
            total: { total: 61 },
          },
        ],
        grandTotal: { total: 61 },
        byCourse: { rows: [{ course: 1, total: 61 }], total: { total: 61 } },
        facultyByCourse: { rows: [{ facultyShort: 'Davolash ishi', courses: [61, 0, 0, 0, 0, 0], total: 61 }], total: { courses: [61, 0, 0, 0, 0, 0], total: 61 } },
        countries: { rows: [{ country: 'Hindiston', total: 3 }], total: { total: 3, boys: 0, girls: 0 } },
        pendingFaculties: ['Pediatriya fakulteti'],
      },
    });
    expect(s.academicYearTitle).toBe('2026/2027');
    expect(s.facultyBlocks[0]?.directions[0]).toMatchObject({ label: '60910200-Davolash ishi (milliy)', total: { total: 61, boys: 0 } });
    expect(s.facultyBlocks[0]?.directions[0]?.rows[0]).toMatchObject({ course: 1, total: 61, girls: 0 });
    expect(s.facultyByCourse.rows[0]?.courses).toEqual([61, 0, 0, 0, 0, 0]);
    expect(s.countries.rows[0]).toEqual({ country: 'Hindiston', total: 3, boys: 0, girls: 0 });
    expect(s.pendingFaculties).toEqual(['Pediatriya fakulteti']);
  });
});
