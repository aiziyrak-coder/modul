import { describe, expect, it } from 'vitest';
import { mapAbsenceStreak } from './notice-api';

type Raw = Parameters<typeof mapAbsenceStreak>[0];

const NEW_RESPONSE = {
  resident: 'r1',
  days: 3,
  from: '2026-09-21',
  to: '2026-09-25',
  threshold: 3,
  eligible: true,
  windowDays: 7,
  windowFrom: '2026-09-19',
  windowTo: '2026-09-25',
  dayKeys: ['2026-09-21', '2026-09-23', '2026-09-25'],
  lastNotice: null,
};

const LAST_NOTICE = {
  id: 'n9',
  createdAt: '2026-09-22T05:00:00.000Z',
  days: 3,
  from: '2026-09-15',
  to: '2026-09-19',
};

describe('mapAbsenceStreak — yangi backend', () => {
  it('to‘liq javob', () => {
    expect(mapAbsenceStreak(NEW_RESPONSE, 'r1')).toEqual({
      residentId: 'r1',
      days: 3,
      from: '2026-09-21',
      to: '2026-09-25',
      threshold: 3,
      eligible: true,
      windowDays: 7,
      windowFrom: '2026-09-19',
      windowTo: '2026-09-25',
      dayKeys: ['2026-09-21', '2026-09-23', '2026-09-25'],
      lastNotice: null,
    });
  });

  it('lastNotice o‘tadi', () => {
    expect(mapAbsenceStreak({ ...NEW_RESPONSE, lastNotice: LAST_NOTICE }, 'r1').lastNotice).toEqual(
      LAST_NOTICE,
    );
  });

  it('`resident` yo‘q bo‘lsa so‘ralgan id', () => {
    expect(mapAbsenceStreak({ ...NEW_RESPONSE, resident: undefined }, 'r7').residentId).toBe('r7');
  });
});

describe('mapAbsenceStreak — eski backend (ABS-Q11=A)', () => {
  it('yangi kalitlarsiz → windowDays null, dayKeys [], lastNotice null', () => {
    const s = mapAbsenceStreak(
      {
        resident: 'r1',
        days: 4,
        from: '2026-09-21',
        to: '2026-09-24',
        threshold: 3,
        eligible: true,
      },
      'r1',
    );
    expect(s).toEqual({
      residentId: 'r1',
      days: 4,
      from: '2026-09-21',
      to: '2026-09-24',
      threshold: 3,
      eligible: true,
      windowDays: null,
      windowFrom: null,
      windowTo: null,
      dayKeys: [],
      lastNotice: null,
    });
  });

  it('bo‘sh javob — xavfsiz sukutlar', () => {
    expect(mapAbsenceStreak({}, 'r1')).toMatchObject({
      residentId: 'r1',
      days: 0,
      from: null,
      to: null,
      threshold: null,
      eligible: false,
      windowDays: null,
      dayKeys: [],
      lastNotice: null,
    });
  });

  it.each([
    ['satr', '7'],
    ['null', null],
  ])('windowDays: %s → null', (_label, windowDays) => {
    expect(mapAbsenceStreak({ ...NEW_RESPONSE, windowDays } as Raw, 'r1').windowDays).toBeNull();
  });

  it.each([
    ['null', null],
    ['satr', '2026-09-21'],
    ['obyekt', { a: 1 }],
  ])('dayKeys: %s → []', (_label, dayKeys) => {
    expect(mapAbsenceStreak({ ...NEW_RESPONSE, dayKeys } as Raw, 'r1').dayKeys).toEqual([]);
  });
});

describe('mapAbsenceStreak — eligible boolean', () => {
  it.each([
    [true, true],
    [false, false],
    [undefined, false],
    [null, false],
    [1, true],
    [0, false],
  ])('%p → %p', (eligible, expected) => {
    const s = mapAbsenceStreak({ ...NEW_RESPONSE, eligible } as Raw, 'r1');
    expect(s.eligible).toBe(expected);
    expect(typeof s.eligible).toBe('boolean');
  });
});

describe('mapAbsenceStreak — buzuq lastNotice → null', () => {
  it.each([
    ['satr', 'n9'],
    ['massiv', [LAST_NOTICE]],
    ['id siz', { ...LAST_NOTICE, id: undefined }],
    ['createdAt siz', { ...LAST_NOTICE, createdAt: undefined }],
    ['days satr', { ...LAST_NOTICE, days: '3' }],
    ['from siz', { ...LAST_NOTICE, from: undefined }],
    ['to null', { ...LAST_NOTICE, to: null }],
  ])('%s', (_label, lastNotice) => {
    expect(mapAbsenceStreak({ ...NEW_RESPONSE, lastNotice } as Raw, 'r1').lastNotice).toBeNull();
  });
});
