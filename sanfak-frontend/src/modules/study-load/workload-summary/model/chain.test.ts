import { describe, expect, it } from 'vitest';
import { summaryTurn } from './chain';

describe('summaryTurn — navbat qoidasi (backend STEP_ROLES nusxasi)', () => {
  it("draft — faqat O'UB yuboradi, o'chira oladi; tasdiqlash yo'q", () => {
    const t = summaryTurn('draft', null, 'oquv_uslubiy_boshqarma', false);
    expect(t).toEqual({ canSubmit: true, canApprove: false, canReject: false, canReopen: false, canDelete: true });
    expect(summaryTurn('draft', null, 'reja_moliya', false).canSubmit).toBe(false);
  });

  it('in_review — faqat navbatdagi rol tasdiqlaydi/rad etadi', () => {
    expect(summaryTurn('in_review', 'financial', 'reja_moliya', false).canApprove).toBe(true);
    expect(summaryTurn('in_review', 'financial', 'prorektor', false).canApprove).toBe(false);
    expect(summaryTurn('in_review', 'rektor', 'rektor', false).canReject).toBe(true);
    expect(summaryTurn('in_review', 'financial', 'reja_moliya', false).canDelete).toBe(false);
  });

  it("rejected — faqat O'UB qayta ochadi", () => {
    expect(summaryTurn('rejected', null, 'oquv_uslubiy_boshqarma', false).canReopen).toBe(true);
    expect(summaryTurn('rejected', null, 'rektor', false).canReopen).toBe(false);
  });

  it("o'chirish (PR #272) — faqat draft va rejected; boshqa holatlarda yo'q", () => {
    const byStatus = (s: string) => summaryTurn(s, null, 'oquv_uslubiy_boshqarma', false).canDelete;
    expect(byStatus('draft')).toBe(true);
    expect(byStatus('rejected')).toBe(true);
    for (const s of ['in_review', 'approved', 'superseded']) expect(byStatus(s)).toBe(false);
  });

  it("approved / superseded — hech qanday amal yo'q", () => {
    for (const s of ['approved', 'superseded']) {
      const t = summaryTurn(s, null, 'oquv_uslubiy_boshqarma', true);
      expect(Object.values(t).some(Boolean)).toBe(false);
    }
  });

  it("super ('*') sessiyada navbat cheklovi yo'q (dev/test)", () => {
    expect(summaryTurn('in_review', 'rektor', 'oqituvchi', true).canApprove).toBe(true);
  });
});
