import { describe, expect, it } from 'vitest';
import {
  getReportRejectionComment,
  mapPersonalReport,
  toCreateReportPayload,
  toUpdateReportPayload,
} from './reports-mapper';
import type { BackendPersonalReport } from './reports-mapper';
import type { PersonalReport, ReportFormValues } from '../model/report-types';

function buildBackendReport(overrides: Partial<BackendPersonalReport> = {}): BackendPersonalReport {
  return {
    _id: 'r1',
    plan: 'plan-1',
    teacher: { _id: 't1', firstName: 'Ali', lastName: 'Valiyev' },
    academicYear: { _id: 'ay1', title: '2025-2026' },
    semester: 1,
    text: 'Hisobot matni',
    councilDecisionFile: null,
    status: 'draft',
    approvals: [],
    createdAt: '2026-07-30T00:00:00.000Z',
    ...overrides,
  };
}

describe('mapPersonalReport', () => {
  it("plan ObjectId yoki populate qilingan obyektdan bir xilda id chiqaradi", () => {
    expect(mapPersonalReport(buildBackendReport({ plan: 'plan-1' })).planId).toBe('plan-1');
    expect(mapPersonalReport(buildBackendReport({ plan: { _id: 'plan-2' } })).planId).toBe('plan-2');
  });

  it("teacher/academicYear populate qilingan bo'lsa nom/sarlavhani map qiladi", () => {
    const report = mapPersonalReport(buildBackendReport());
    expect(report.teacherName).toBe('Valiyev Ali');
    expect(report.academicYearTitle).toBe('2025-2026');
    expect(report.academicYearId).toBe('ay1');
  });

  it("approvals[] ni map qiladi — approvedBy POPULATE QILINMAGANI uchun faqat id sifatida", () => {
    const report = mapPersonalReport(
      buildBackendReport({
        approvals: [
          { step: 'dekan', label: 'Fakultet dekani', status: 'approved', approvedBy: 'u1', date: '2026-07-30T00:00:00.000Z', comment: null },
          { step: 'kotib', label: 'Fakultet ilmiy kengash kotibi', status: 'pending', approvedBy: null, date: null, comment: null },
        ],
      }),
    );

    expect(report.approvals).toHaveLength(2);
    expect(report.approvals[0]).toMatchObject({ step: 'dekan', status: 'approved', approvedById: 'u1' });
    expect(report.approvals[1]).toMatchObject({ step: 'kotib', status: 'pending', approvedById: null });
  });

  it("councilDecisionFile yo'q bo'lsa null qaytaradi", () => {
    expect(mapPersonalReport(buildBackendReport({ councilDecisionFile: undefined })).councilDecisionFile).toBeNull();
    expect(
      mapPersonalReport(buildBackendReport({ councilDecisionFile: 'https://x.uz/doc' })).councilDecisionFile,
    ).toBe('https://x.uz/doc');
  });
});

describe('D-15 — imzolovchi ismi (approvals[].approvedBy populate)', () => {
  it("populate qilingan bo'lsa Familiya Ism chiqadi", () => {
    const b = buildBackendReport();
    b.approvals = [
      {
        step: 'dekan',
        label: 'Fakultet dekani',
        status: 'approved',
        approvedBy: { _id: 'u1', firstName: 'Feruza', lastName: 'Abdullayeva' },
        date: '2026-08-03T00:00:00.000Z',
        comment: null,
      },
    ];
    const step = mapPersonalReport(b).approvals[0];
    expect(step?.approvedByName).toBe('Abdullayeva Feruza');
    expect(step?.approvedById).toBe('u1');
  });

  it("xom ObjectId (populate yo'q) — ism null, id saqlanadi", () => {
    const b = buildBackendReport();
    b.approvals = [
      { step: 'dekan', label: 'Fakultet dekani', status: 'approved', approvedBy: 'u1', date: null, comment: null },
    ];
    const step = mapPersonalReport(b).approvals[0];
    expect(step?.approvedByName).toBeNull();
    expect(step?.approvedById).toBe('u1');
  });
});

describe('getReportRejectionComment', () => {
  it("rad etilgan bosqichning izohini topadi", () => {
    const report: PersonalReport = {
      ...mapPersonalReport(buildBackendReport()),
      status: 'rejected',
      approvals: [
        { step: 'dekan', label: 'Fakultet dekani', status: 'rejected', approvedById: 'u1', approvedByName: 'Abdullayeva Feruza', date: null, comment: 'Yetarli emas' },
        { step: 'kotib', label: 'Fakultet ilmiy kengash kotibi', status: 'pending', approvedById: null, approvedByName: null, date: null, comment: null },
      ],
    };
    expect(getReportRejectionComment(report)).toBe('Yetarli emas');
  });

  it("rad etilgan bosqich yo'q bo'lsa null qaytaradi", () => {
    const report = mapPersonalReport(buildBackendReport());
    expect(getReportRejectionComment(report)).toBeNull();
  });
});

describe('toCreateReportPayload / toUpdateReportPayload', () => {
  const values: ReportFormValues = {
    semester: 1,
    text: '  Hisobot matni  ',
    councilDecisionFile: '  https://x.uz/qaror  ',
  };

  it("create payload plan/academicYear qo'shadi va matnni trim qiladi", () => {
    const payload = toCreateReportPayload(values, 'plan-1', 'ay-1');
    expect(payload).toEqual({
      plan: 'plan-1',
      academicYear: 'ay-1',
      semester: 1,
      text: 'Hisobot matni',
      councilDecisionFile: 'https://x.uz/qaror',
    });
  });

  it("councilDecisionFile bo'sh bo'lsa create'da undefined bo'ladi", () => {
    const payload = toCreateReportPayload({ ...values, councilDecisionFile: '  ' }, 'plan-1', 'ay-1');
    expect(payload.councilDecisionFile).toBeUndefined();
  });

  it("update payload plan/academicYear yubormaydi, bo'sh councilDecisionFile null bo'ladi", () => {
    const payload = toUpdateReportPayload({ ...values, councilDecisionFile: '' });
    expect(payload).toEqual({
      semester: 1,
      text: 'Hisobot matni',
      councilDecisionFile: null,
    });
  });
});
