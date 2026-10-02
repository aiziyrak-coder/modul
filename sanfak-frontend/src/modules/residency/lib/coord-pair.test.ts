import { describe, expect, it } from 'vitest';
import { formatCoordPair, parseCoordPair } from './coord-pair';

describe('parseCoordPair — to‘g‘ri kiritma', () => {
  it('Google Maps shakli', () => {
    expect(parseCoordPair('41.311081, 69.240562')).toEqual({
      kind: 'ok',
      value: { lat: 41.311081, lng: 69.240562 },
    });
  });

  it.each([
    ['vergulsiz bo‘shliq', '41.311081 69.240562'],
    ['nuqtali vergul', '41.311081; 69.240562'],
    ['ortiqcha bo‘shliq', '  41.311081 ,   69.240562  '],
  ])('%s ham qabul qilinadi', (_label, text) => {
    const r = parseCoordPair(text);
    expect(r.kind).toBe('ok');
  });

  it('manfiy qiymatlar', () => {
    expect(parseCoordPair('-33.8688, 151.2093')).toEqual({
      kind: 'ok',
      value: { lat: -33.8688, lng: 151.2093 },
    });
  });

  it.each(['', '   '])('bo‘sh (%p) — xato EMAS', (text) => {
    expect(parseCoordPair(text)).toEqual({ kind: 'empty' });
  });
});

describe('parseCoordPair — rad etish', () => {
  it('o‘nlik VERGUL aniq xabar bilan rad etiladi', () => {
    const r = parseCoordPair('41,311081, 69,240562');
    expect(r.kind).toBe('error');
    if (r.kind === 'error') expect(r.message).toContain('VERGUL');
  });

  it.each([
    ['bitta son', '41.311081'],
    ['uchta son', '41.3 69.2 12.1'],
    ['besh son', '1 2 3 4 5'],
  ])('%s — shakl xatosi', (_label, text) => {
    expect(parseCoordPair(text).kind).toBe('error');
  });

  it('son bo‘lmagan matn', () => {
    const r = parseCoordPair('shimol, janub');
    expect(r.kind).toBe('error');
    if (r.kind === 'error') expect(r.message).toContain('son');
  });

  it.each([
    ['kenglik 90 dan katta', '91, 69'],
    ['kenglik −90 dan kichik', '-91, 69'],
    ['uzunlik 180 dan katta', '41, 181'],
    ['uzunlik −180 dan kichik', '41, -181'],
  ])('%s — chegaradan tashqari', (_label, text) => {
    expect(parseCoordPair(text).kind).toBe('error');
  });

  it.each(['90, 180', '-90, -180'])('chegaraning O‘ZI (%s) qabul qilinadi', (text) => {
    expect(parseCoordPair(text).kind).toBe('ok');
  });
});

describe('formatCoordPair', () => {
  it('ikkala son bor', () => {
    expect(formatCoordPair(41.311081, 69.240562)).toBe('41.311081, 69.240562');
  });

  it.each([
    [null, 69.2],
    [41.3, null],
    [null, null],
  ])('yarim juft (%p, %p) — bo‘sh satr', (lat, lng) => {
    expect(formatCoordPair(lat, lng)).toBe('');
  });

  it('0 haqiqiy qiymat sifatida chiqadi', () => {
    expect(formatCoordPair(0, 0)).toBe('0, 0');
  });
});

describe('aylanma', () => {
  it.each([
    [41.311081, 69.240562],
    [-33.8688, 151.2093],
    [0, 0],
  ])('%p, %p', (lat, lng) => {
    const r = parseCoordPair(formatCoordPair(lat, lng));
    expect(r).toEqual({ kind: 'ok', value: { lat, lng } });
  });
});
