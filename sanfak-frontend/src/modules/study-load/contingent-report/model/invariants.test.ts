import { describe, expect, it } from 'vitest';
import { invalidRowCount, zeroNumbers } from './invariants';

const valid = () => ({
  ...zeroNumbers(),
  total: 10,
  boys: 6,
  girls: 4,
  grant: 7,
  contract: 3,
  grantBoys: 4,
  grantGirls: 3,
  contractBoys: 2,
  contractGirls: 1,
});

describe('invalidRowCount — saqlangan hujjat', () => {
  it("mos jadval va xorijiy qatorlar — 0", () => {
    expect(invalidRowCount([valid()], [{ country: 'Hindiston', total: 3, boys: 1, girls: 2 }])).toBe(0);
  });

  it("prefill qatori (jami 100, jins/grant 0) buzilgan sanaladi", () => {
    expect(invalidRowCount([valid(), { ...zeroNumbers(), total: 100 }], [])).toBe(1);
  });

  it('xorijiy qator ham sanaladi (o\'g\'il + qiz ≠ jami)', () => {
    expect(invalidRowCount([valid()], [{ country: 'Hindiston', total: 3, boys: 1, girls: 1 }])).toBe(1);
  });

  it("bo'sh hujjat — 0", () => {
    expect(invalidRowCount([], [])).toBe(0);
  });
});
