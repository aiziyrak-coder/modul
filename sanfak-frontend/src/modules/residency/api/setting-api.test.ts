import { describe, expect, it } from 'vitest';
import { mapSetting, SETTING_FALLBACK } from './setting-api';

type Raw = Parameters<typeof mapSetting>[0];

describe('mapSetting — absenceWindowDays', () => {
  it('yo‘q → null (eski backend)', () => {
    expect(
      mapSetting({ workDayFrom: '08:30', workDayTo: '15:00', absenceStreakDays: 4 })
        .absenceWindowDays,
    ).toBeNull();
  });

  it('son → son', () => {
    expect(mapSetting({ absenceStreakDays: 3, absenceWindowDays: 10 }).absenceWindowDays).toBe(10);
  });

  it.each([
    ['null', null],
    ['satr', '7'],
  ])('%s → null', (_label, absenceWindowDays) => {
    expect(mapSetting({ absenceWindowDays } as unknown as Raw).absenceWindowDays).toBeNull();
  });
});

describe('mapSetting — qolgan maydonlar', () => {
  it('to‘liq javob', () => {
    expect(
      mapSetting({
        _id: 's1',
        workDayFrom: '08:30',
        workDayTo: '15:00',
        absenceStreakDays: 4,
        absenceWindowDays: 10,
      }),
    ).toEqual({
      workDayFrom: '08:30',
      workDayTo: '15:00',
      absenceStreakDays: 4,
      absenceWindowDays: 10,
    });
  });

  it('absenceStreakDays yo‘q → 3', () => {
    expect(mapSetting({}).absenceStreakDays).toBe(3);
  });

  it('bo‘sh javob — vaqtlar sukutdan, W null', () => {
    expect(mapSetting({})).toEqual({
      workDayFrom: '09:00',
      workDayTo: '14:00',
      absenceStreakDays: 3,
      absenceWindowDays: null,
    });
  });
});

describe('SETTING_FALLBACK', () => {
  it('backend model sukutlari bilan bir xil', () => {
    expect(SETTING_FALLBACK).toEqual({
      workDayFrom: '09:00',
      workDayTo: '14:00',
      absenceStreakDays: 3,
      absenceWindowDays: 7,
    });
  });
});
