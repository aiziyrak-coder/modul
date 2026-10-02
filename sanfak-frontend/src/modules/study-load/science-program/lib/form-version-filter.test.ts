import { describe, expect, it } from 'vitest';
import { filterByFormVersion, toFormVersionFilter } from './form-version-filter';
import type { ScienceProgramFormVersion } from '../model/types';

const ROWS: { id: string; formVersion: ScienceProgramFormVersion }[] = [
  { id: 'a', formVersion: 'v259' },
  { id: 'b', formVersion: 'v142' },
  { id: 'c', formVersion: 'v259' },
];

describe('filterByFormVersion', () => {
  it("filtr tanlanmagan (undefined = 'Barcha tartiblar') — hamma qator qoladi", () => {
    expect(filterByFormVersion(ROWS, undefined)).toHaveLength(3);
  });

  it("'142-son' tanlanganda FAQAT v142 qatorlar qoladi", () => {
    const res = filterByFormVersion(ROWS, 'v142');

    expect(res.map((r) => r.id)).toEqual(['b']);
  });

  it("'259-son' tanlanganda FAQAT v259 qatorlar qoladi", () => {
    const res = filterByFormVersion(ROWS, 'v259');

    expect(res.map((r) => r.id)).toEqual(['a', 'c']);
  });

  it('asl massivni o`zgartirmaydi (yangi massiv qaytaradi)', () => {
    const res = filterByFormVersion(ROWS, 'v142');

    expect(ROWS).toHaveLength(3);
    expect(res).not.toBe(ROWS);
  });
});

describe('toFormVersionFilter', () => {
  it("faqat 'v259' va 'v142' qabul qilinadi", () => {
    expect(toFormVersionFilter('v259')).toBe('v259');
    expect(toFormVersionFilter('v142')).toBe('v142');
  });

  it("tozalash (undefined) va noma'lum qiymat — filtrsiz", () => {
    expect(toFormVersionFilter(undefined)).toBeUndefined();
    expect(toFormVersionFilter('v1')).toBeUndefined();
  });
});
