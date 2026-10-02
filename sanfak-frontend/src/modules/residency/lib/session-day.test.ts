import { describe, expect, it } from 'vitest';
import {
  academicYearLastDay,
  announceableRange,
  isDayInRange,
  isPastDay,
  toDayRange,
} from './session-day';

describe('academicYearLastDay', () => {
  it('sentabr–dekabr — keyingi yilning 31-avgusti', () => {
    expect(academicYearLastDay('2026-09-01')).toBe('2027-08-31');
    expect(academicYearLastDay('2026-12-31')).toBe('2027-08-31');
  });

  it('yanvar–avgust — shu yilning 31-avgusti', () => {
    expect(academicYearLastDay('2027-01-01')).toBe('2027-08-31');
    expect(academicYearLastDay('2027-08-31')).toBe('2027-08-31');
  });
});

describe('announceableRange', () => {
  it('UZ kuni: 31-avgust 20:00Z — UZ da allaqachon 1-sentabr, ya’ni YANGI o‘quv yili', () => {
    expect(announceableRange(new Date('2027-08-31T20:00:00Z'))).toEqual({
      from: '2027-09-01',
      to: '2028-08-31',
    });
  });

  it('UZ 00:00–05:00 oralig‘i — UTC hali kecha, lekin `from` UZ bugun', () => {
    expect(announceableRange(new Date('2026-09-26T19:30:00Z')).from).toBe('2026-09-27');
  });

  it('isDayInRange — chegaralar kiradi, tashqarisi yo‘q', () => {
    const r = { from: '2026-09-27', to: '2027-08-31' };
    expect(isDayInRange('2026-09-27', r)).toBe(true);
    expect(isDayInRange('2027-08-31', r)).toBe(true);
    expect(isDayInRange('2026-09-26', r)).toBe(false);
    expect(isDayInRange('2027-09-01', r)).toBe(false);
  });
});

describe('toDayRange — server `400 day_not_announceable {from, to}` meta', () => {
  it('ikkalasi `YYYY-MM-DD` va from ≤ to — oraliq', () => {
    expect(toDayRange({ from: '2026-09-28', to: '2027-08-31' })).toEqual({
      from: '2026-09-28',
      to: '2027-08-31',
    });
    expect(toDayRange({ from: '2026-09-28', to: '2026-09-28', extra: 1 })).toEqual({
      from: '2026-09-28',
      to: '2026-09-28',
    });
  });

  it.each([
    [{}],
    [{ from: '2026-09-28' }],
    [{ from: '2026-09-28T00:00:00.000Z', to: '2027-08-31' }],
    [{ from: '28.09.2026', to: '31.08.2027' }],
    [{ from: 20260928, to: 20270831 }],
    [{ from: '2027-08-31', to: '2026-09-28' }],
  ])('yaroqsiz meta (%j) → null (mahalliy oraliq saqlanadi)', (meta) => {
    expect(toDayRange(meta)).toBeNull();
  });
});

describe('isPastDay — UZ kuni bo‘yicha (F1-Q2 izohi)', () => {
  const NOW = new Date('2026-09-27T19:30:00Z');

  it('kecha — o‘tgan; bugun va ertaga — yo‘q', () => {
    expect(isPastDay('2026-09-27', NOW)).toBe(true);
    expect(isPastDay('2026-09-28', NOW)).toBe(false);
    expect(isPastDay('2026-09-29', NOW)).toBe(false);
  });

  it('bo‘sh kalit — yo‘q (noma’lum kun yopilgan deyilmaydi)', () => {
    expect(isPastDay('', NOW)).toBe(false);
  });
});
