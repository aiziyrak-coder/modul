import { describe, expect, it } from 'vitest';
import { nameOf } from './user-name';

describe('user-name — F.I.Sh tartibi', () => {
  it('uchala qismni familiya · ism · sharif tartibida beradi', () => {
    expect(nameOf({ firstName: 'Aziz', lastName: 'Karimov', middleName: 'Akmalovich' })).toBe(
      'Karimov Aziz Akmalovich',
    );
  });

  it("sharif kelmasa TARTIB saqlanadi, faqat qism tushadi", () => {
    expect(nameOf({ firstName: 'Aziz', lastName: 'Karimov' })).toBe('Karimov Aziz');
  });

  it("bo'sh/probel qismlar tashlanadi (qo'sh bo'shliq hosil bo'lmaydi)", () => {
    expect(nameOf({ firstName: 'Aziz', lastName: '  ', middleName: 'Akmalovich' })).toBe(
      'Aziz Akmalovich',
    );
  });

  it('populate qilinmagan (satr) yoki bo\'sh qiymatda `null` — fallback chaqiruvchida', () => {
    expect(nameOf('64f1a2b3c4d5e6f7a8b9c0d1')).toBeNull();
    expect(nameOf(null)).toBeNull();
    expect(nameOf(undefined)).toBeNull();
    expect(nameOf({})).toBeNull();
  });
});
