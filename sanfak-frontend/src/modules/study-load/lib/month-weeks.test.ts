import { describe, expect, it } from 'vitest';
import {
  equalMonthCounts,
  monthCountsOf,
  totalOf,
  validateMonthCounts,
  type MonthCount,
} from './month-weeks';

const MONTHS = [
  'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr', 'Yanvar', 'Fevral',
  'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust',
];
const LIVE = [5, 4, 5, 4, 5, 4, 5, 4, 4, 4, 4, 4];
const counts = (arr: number[]): MonthCount[] => MONTHS.map((month, i) => ({ month, count: arr[i]! }));

describe('monthCountsOf / totalOf', () => {
  it('grid oylaridan taqsimot (haftalar soni) va jami', () => {
    const months = MONTHS.map((month, i) => ({ month, weeks: Array.from({ length: LIVE[i]! }) }));
    const out = monthCountsOf(months);
    expect(out.map((m) => m.count)).toEqual(LIVE);
    expect(totalOf(out)).toBe(52);
  });
  it('bo`sh / null → bo`sh massiv', () => {
    expect(monthCountsOf(undefined)).toEqual([]);
    expect(monthCountsOf([{ month: 'X', weeks: null }])).toEqual([{ month: 'X', count: 0 }]);
  });
});

describe('equalMonthCounts — parser fallback formulasi', () => {
  it('52/12 → 5,5,5,5,4,4,4,4,4,4,4,4', () => {
    expect(equalMonthCounts(MONTHS, 52).map((m) => m.count)).toEqual([5, 5, 5, 5, 4, 4, 4, 4, 4, 4, 4, 4]);
  });
  it('48/12 → hammasi 4; oy nomlari saqlanadi', () => {
    const out = equalMonthCounts(MONTHS, 48);
    expect(out.every((m) => m.count === 4)).toBe(true);
    expect(out[0]!.month).toBe('Sentabr');
  });
});

describe('validateMonthCounts — Saqlash darvozasi', () => {
  it('to`g`ri (52) → null', () => {
    expect(validateMonthCounts(counts(LIVE), 52)).toBeNull();
  });
  it('yig`indi mos emas → total', () => {
    expect(validateMonthCounts(counts([4, 4, 5, 4, 5, 4, 5, 4, 4, 4, 4, 4]), 52)).toBe('total');
  });
  it('0 → belowOne; kasr → notInteger; bo`sh → empty', () => {
    expect(validateMonthCounts(counts([0, 9, 5, 4, 5, 4, 5, 4, 4, 4, 4, 4]), 52)).toBe('belowOne');
    expect(validateMonthCounts(counts([5.5, 3.5, 5, 4, 5, 4, 5, 4, 4, 4, 4, 4]), 52)).toBe('notInteger');
    expect(validateMonthCounts([], 52)).toBe('empty');
  });
});
