import { describe, expect, it } from 'vitest';
import { canSubmitEvidence, isEvidenceResubmit } from './evidence-submit';
import type { WorkItemVerification } from './types';

const verification = (status: WorkItemVerification['status']): WorkItemVerification => ({
  status,
  date: null,
  comment: null,
});

describe('evidence-submit (D-32)', () => {
  it('bajarilmagan faoliyat — «Bajarildi» tugmasi bor', () => {
    expect(canSubmitEvidence({ status: 'planned', verification: null })).toBe(true);
    expect(canSubmitEvidence({ status: 'overdue', verification: null })).toBe(true);
  });

  it('dalil rad etilgan — «Qayta yuborish» (berk ko`cha yo`q)', () => {
    const item = { status: 'completed' as const, verification: verification('rejected') };
    expect(canSubmitEvidence(item)).toBe(true);
    expect(isEvidenceResubmit(item)).toBe(true);
  });

  it('tekshiruvdagi yoki tasdiqlangan dalil — tugma yo`q (D-7: tasdiq pending`ga tushmasin)', () => {
    expect(canSubmitEvidence({ status: 'completed', verification: verification('pending') })).toBe(false);
    expect(canSubmitEvidence({ status: 'completed', verification: verification('approved') })).toBe(false);
  });
});
