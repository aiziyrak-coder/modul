import { describe, expect, it } from 'vitest';
import { canRejectWorkload, canRespondToWorkload } from './can-respond';

describe('canRespondToWorkload', () => {
  it('pending + in_review + blockId → true (asosiy oqim)', () => {
    expect(
      canRespondToWorkload({
        acceptanceStatus: 'pending',
        distributionStatus: 'in_review',
        blockId: 'b1',
      }),
    ).toBe(true);
  });

  it('pending + draft + blockId → true (backend hali ruxsat beradi)', () => {
    expect(
      canRespondToWorkload({
        acceptanceStatus: 'pending',
        distributionStatus: 'draft',
        blockId: 'b1',
      }),
    ).toBe(true);
  });

  it('pending + rejected + blockId → true (backend hali ruxsat beradi)', () => {
    expect(
      canRespondToWorkload({
        acceptanceStatus: 'pending',
        distributionStatus: 'rejected',
        blockId: 'b1',
      }),
    ).toBe(true);
  });

  it('D-26: pending + approved → qabul qilish MUMKIN, rad etish YO\'Q', () => {
    const row = {
      acceptanceStatus: 'pending' as const,
      distributionStatus: 'approved' as const,
      blockId: 'b1',
    };
    expect(canRespondToWorkload(row)).toBe(true);
    expect(canRejectWorkload(row)).toBe(false);
  });

  it('D-26: tasdiqlanmagan taqsimotda rad etish avvalgidek bor', () => {
    expect(
      canRejectWorkload({
        acceptanceStatus: 'pending',
        distributionStatus: 'in_review',
        blockId: 'b1',
      }),
    ).toBe(true);
  });

  it('D-26: approved + accepted → hech qanday javob yo\'q', () => {
    expect(
      canRespondToWorkload({
        acceptanceStatus: 'accepted',
        distributionStatus: 'approved',
        blockId: 'b1',
      }),
    ).toBe(false);
  });

  it('accepted + in_review → false (eski xulq saqlangan)', () => {
    expect(
      canRespondToWorkload({
        acceptanceStatus: 'accepted',
        distributionStatus: 'in_review',
        blockId: 'b1',
      }),
    ).toBe(false);
  });

  it('rejected + in_review → false (eski xulq saqlangan)', () => {
    expect(
      canRespondToWorkload({
        acceptanceStatus: 'rejected',
        distributionStatus: 'in_review',
        blockId: 'b1',
      }),
    ).toBe(false);
  });

  it('pending + in_review + blockId=null → false (ADR-007: bloksiz qatorga javob berib bo\'lmaydi)', () => {
    expect(
      canRespondToWorkload({
        acceptanceStatus: 'pending',
        distributionStatus: 'in_review',
        blockId: null,
      }),
    ).toBe(false);
  });

  it('ADR-043: superseded taqsimot → false (backend 404)', () => {
    expect(
      canRespondToWorkload({ acceptanceStatus: 'pending', distributionStatus: 'superseded', blockId: 'b1' }),
    ).toBe(false);
    expect(
      canRespondToWorkload({
        acceptanceStatus: 'pending',
        distributionStatus: 'in_review',
        blockId: 'b1',
        superseded: true,
      }),
    ).toBe(false);
  });
});
