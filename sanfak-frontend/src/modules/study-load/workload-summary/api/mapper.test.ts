import { describe, expect, it } from 'vitest';
import { mapWorkloadSummary, mapWorkloadSummaryDetail, type BackendWorkloadSummary } from './mapper';

const base: BackendWorkloadSummary = {
  _id: '6aabed57724a5b474e97c53c',
  academicYear: { _id: '6a8bdb6c5b767d415c184735', title: '2024/2025' },
  academicYearTitle: '2024/2025',
  status: 'in_review',
  snapshot: {
    rowCount: 1,
    generatedAt: '2026-09-17T12:00:00.000Z',
    totals: { total: 234, hourly: 234, dh: { docent: 1 }, support: { laborant: 2 } },
    rows: [
      {
        no: 1,
        department: 'Mikrobiologiya, virusologiya va immunologiya kafedrasi',
        head: 'F.Rasulov',
        total: 234,
        hourly: 234,
        forDistribution: 0,
        positions: 0.5,
        dh: { docent: 1 },
        ts: { assistant: 0.5 },
        supportTotal: 1,
        support: { laborant: 1 },
      },
    ],
    missingDepartments: ['Kafedra A', 'Kafedra B'],
  },
  approvalSteps: [
    {
      step: 'methodical',
      status: 'approved',
      approvedBy: { _id: 'u1', lastName: "Yo'ldoshev", firstName: 'Sobitali' },
      date: '2026-09-17T12:20:00.000Z',
    },
    { step: 'financial', status: 'pending', approvedBy: null },
    { step: 'prorektor', status: 'pending' },
    { step: 'rektor', status: 'pending' },
  ],
  staleness: { isStale: true, added: 1, changed: 0, removed: 0 },
  createdAt: '2026-09-17T12:00:00.000Z',
};

describe('mapWorkloadSummary', () => {
  it('_id → id, populated yil → title, currentStep = birinchi pending', () => {
    const m = mapWorkloadSummary(base);
    expect(m.id).toBe('6aabed57724a5b474e97c53c');
    expect(m.academicYearId).toBe('6a8bdb6c5b767d415c184735');
    expect(m.academicYearTitle).toBe('2024/2025');
    expect(m.rowCount).toBe(1);
    expect(m.totalHours).toBe(234);
    expect(m.currentStep).toBe('financial');
    expect('_id' in m).toBe(false);
  });

  it("paginate (suratsiz) — rows yo'q, yil string id bo'lsa academicYearTitle'dan", () => {
    const m = mapWorkloadSummary({
      _id: 'x',
      academicYear: '6a8bdb6c5b767d415c184735',
      academicYearTitle: '2025/2026',
      status: 'draft',
      snapshot: { rowCount: 3 },
    });
    expect(m.academicYearTitle).toBe('2025/2026');
    expect(m.currentStep).toBeNull();
    expect(m.totalHours).toBe(0);
  });

  it("approved hujjatda currentStep null (navbat yo'q)", () => {
    const m = mapWorkloadSummary({ ...base, status: 'approved' });
    expect(m.currentStep).toBeNull();
  });
});

describe('mapWorkloadSummaryDetail', () => {
  it('surat qatorlari, jami, yo’q kafedralar, zanjir, eskirganlik', () => {
    const d = mapWorkloadSummaryDetail(base);
    expect(d.rows).toHaveLength(1);
    expect(d.rows[0]?.department).toContain('Mikrobiologiya');
    expect(d.rows[0]?.dh.docent).toBe(1);
    expect(d.rows[0]?.dh.professor).toBe(0);
    expect(d.totals?.total).toBe(234);
    expect(d.totals?.support.laborant).toBe(2);
    expect(d.missingDepartments).toEqual(['Kafedra A', 'Kafedra B']);
    expect(d.approvalHistory).toHaveLength(4);
    expect(d.approvalHistory[0]?.approverName).toBe("Yo'ldoshev Sobitali");
    expect(d.approvalHistory[0]?.status).toBe('approved');
    expect(d.staleness).toEqual({ isStale: true, added: 1, changed: 0, removed: 0 });
    expect(d.rejectComment).toBeNull();
  });

  it('rad etilgan bosqich izohi rejectComment ga tushadi', () => {
    const d = mapWorkloadSummaryDetail({
      ...base,
      status: 'rejected',
      approvalSteps: [
        { step: 'methodical', status: 'approved' },
        { step: 'financial', status: 'rejected', comment: 'Soatlar mos emas' },
      ],
    });
    expect(d.rejectComment).toBe('Soatlar mos emas');
  });

  it("snapshot yo'q bo'lsa bo'sh, staleness null", () => {
    const d = mapWorkloadSummaryDetail({ _id: 'y', status: 'draft' });
    expect(d.rows).toEqual([]);
    expect(d.totals).toBeNull();
    expect(d.missingDepartments).toEqual([]);
    expect(d.staleness).toBeNull();
  });
});
