import { describe, expect, it } from 'vitest';
import { TIME_RE, toClockMinutes, checkClockPair, isWithinWindow } from './clock-time';

describe('toClockMinutes', () => {
  it.each([
    ['00:00', 0],
    ['09:00', 540],
    ['09:30', 570],
    ['14:00', 840],
    ['23:59', 1439],
  ])('%s -> %i', (hhmm, want) => {
    expect(toClockMinutes(hhmm)).toBe(want);
  });

  it.each([null, undefined, '', '9:00', '24:00', '09:60', '0900', 'salom'])(
    '%p -> null',
    (bad) => {
      expect(toClockMinutes(bad)).toBeNull();
    },
  );

  it('daqiqa solishtiruvi satr solishtiruvidan farq qiladi', () => {
    expect('9:00' > '14:00').toBe(true);
    expect(toClockMinutes('09:00')! < toClockMinutes('14:00')!).toBe(true);
  });

  it('naqsh backenddagi bilan bir xil shaklda', () => {
    expect(TIME_RE.test('09:00')).toBe(true);
    expect(TIME_RE.test('24:00')).toBe(false);
  });
});

describe('checkClockPair', () => {
  it('ikkalasi ham bo‘sh — muammo yo‘q (ixtiyoriy juftlik)', () => {
    expect(checkClockPair('', '')).toBeNull();
    expect(checkClockPair('  ', '  ')).toBeNull();
  });

  it('to‘g‘ri juftlik', () => {
    expect(checkClockPair('09:00', '14:00')).toBeNull();
  });

  it.each([
    ['faqat kelgani', '09:00', ''],
    ['faqat ketgani', '', '14:00'],
  ])('%s -> half', (_label, a, b) => {
    expect(checkClockPair(a, b)).toBe('half');
  });

  it.each([
    ['kelgani buzuq', '9:00', '14:00'],
    ['ketgani buzuq', '09:00', '25:00'],
  ])('%s -> format', (_label, a, b) => {
    expect(checkClockPair(a, b)).toBe('format');
  });

  it('teskari tartib -> order', () => {
    expect(checkClockPair('14:00', '09:00')).toBe('order');
  });

  it('teng vaqtlar ham order (nol uzunlikdagi kun)', () => {
    expect(checkClockPair('09:00', '09:00')).toBe('order');
  });

  it('atrofdagi bo‘shliq e‘tiborga olinmaydi', () => {
    expect(checkClockPair(' 09:00 ', ' 14:00 ')).toBeNull();
  });
});

describe('isWithinWindow', () => {
  const FROM = '09:00';
  const TO = '14:00';

  it('aniq chegaralarda', () => {
    expect(isWithinWindow('09:00', '14:00', FROM, TO)).toBe(true);
  });

  it('kechikib kelgan va erta ketgan — ICHIDA', () => {
    expect(isWithinWindow('09:15', '13:40', FROM, TO)).toBe(true);
  });

  it.each([
    ['erta kelgan', '08:30', '14:00'],
    ['kech ketgan', '09:00', '15:00'],
    ['ikkalasi ham tashqarida', '07:00', '20:00'],
  ])('%s — TASHQARIDA', (_label, a, b) => {
    expect(isWithinWindow(a, b, FROM, TO)).toBe(false);
  });

  it.each([
    ['ikkalasi null', null, null],
    ['faqat kelgani', '09:00', null],
    ['bo‘sh satr', '', ''],
  ])('%s — vaqt yo‘q, tekshirilmaydi', (_label, a, b) => {
    expect(isWithinWindow(a, b, FROM, TO)).toBe(true);
  });

  it('oyna kengaytirilsa avval tashqaridagi vaqt ICHIDA bo‘ladi', () => {
    expect(isWithinWindow('08:30', '18:00', '08:00', '18:00')).toBe(true);
  });

  it('oyna buzuq bo‘lsa tekshirilmaydi (fail-open, server hal qiladi)', () => {
    expect(isWithinWindow('08:00', '20:00', 'salom', TO)).toBe(true);
  });
});
