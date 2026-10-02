import { describe, expect, it } from 'vitest';
import { isSelectableDistribution } from './distribution-select';

describe('isSelectableDistribution (ADR-043)', () => {
  it("almashtirilgan taqsimot taklif qilinmaydi", () => {
    expect(isSelectableDistribution({ status: 'superseded' })).toBe(false);
  });

  it("faol bo'lmagan taqsimot taklif qilinmaydi", () => {
    expect(isSelectableDistribution({ status: 'approved', active: false })).toBe(false);
  });

  it('oddiy holatlar taklif qilinadi', () => {
    for (const status of ['draft', 'in_review', 'approved', 'rejected']) {
      expect(isSelectableDistribution({ status })).toBe(true);
    }
  });

  it("holat kelmasa (eski backend) — avvalgidek taklif qilinadi", () => {
    expect(isSelectableDistribution({})).toBe(true);
    expect(isSelectableDistribution({ status: null, active: null })).toBe(true);
  });
});
