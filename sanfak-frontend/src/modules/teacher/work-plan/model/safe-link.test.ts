import { describe, expect, it } from 'vitest';
import { isSafeLink, isValidOptionalLink } from './safe-link';

describe('safe-link (D-4, D-4b)', () => {
  it('http(s):// va /files/… — xavfsiz', () => {
    expect(isSafeLink('https://kengash.uz/qaror.pdf')).toBe(true);
    expect(isSafeLink('http://scopus.com/1')).toBe(true);
    expect(isSafeLink('/files/reports/a.pdf')).toBe(true);
  });

  it('«abc», javascript: va bo`sh — havola sifatida chizilmaydi', () => {
    expect(isSafeLink('abc')).toBe(false);
    expect(isSafeLink('javascript:alert(1)')).toBe(false);
    expect(isSafeLink('')).toBe(false);
    expect(isSafeLink(null)).toBe(false);
  });

  it('ixtiyoriy maydon: bo`sh — to`g`ri, noto`g`ri matn — xato', () => {
    expect(isValidOptionalLink('')).toBe(true);
    expect(isValidOptionalLink('  ')).toBe(true);
    expect(isValidOptionalLink('abc')).toBe(false);
    expect(isValidOptionalLink(' https://a.uz/q ')).toBe(true);
  });
});
