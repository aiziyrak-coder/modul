import { describe, expect, it } from 'vitest';
import { nameOf } from './user-name';

describe('nameOf — kanonik F.I.Sh', () => {
  it('uchala qismni familiya-ism-sharif tartibida qo‘shadi', () => {
    expect(nameOf({ firstName: 'Sardor', lastName: 'Aliyev', middleName: "Botir o'g'li" })).toBe(
      "Aliyev Sardor Botir o'g'li",
    );
  });

  it('sharif yo‘q bo‘lsa — "Familiya Ism"', () => {
    expect(nameOf({ firstName: 'Sardor', lastName: 'Aliyev' })).toBe('Aliyev Sardor');
  });

  it('faqat bitta qism bo‘lsa — o‘shanisi', () => {
    expect(nameOf({ lastName: 'Aliyev' })).toBe('Aliyev');
    expect(nameOf({ firstName: 'Sardor' })).toBe('Sardor');
  });

  it('bo‘shliqlar tozalanadi va bo‘sh qismlar tushib qoladi', () => {
    expect(nameOf({ firstName: '  Sardor ', lastName: 'Aliyev', middleName: '   ' })).toBe(
      'Aliyev Sardor',
    );
  });

  it('ma’lumot yo‘q bo‘lsa `null` — chaqiruvchi zaxirani O‘ZI tanlaydi', () => {
    expect(nameOf({})).toBeNull();
    expect(nameOf({ firstName: '', lastName: '  ' })).toBeNull();
    expect(nameOf(null)).toBeNull();
    expect(nameOf(undefined)).toBeNull();
  });

  it('populate qilinmagan (satr id) — `null`', () => {
    expect(nameOf('6a7efdac5916905f06cebea8')).toBeNull();
  });

  it('🔴 TESKARI tartibni RAD etadi (regressiya qulfi)', () => {
    expect(nameOf({ firstName: 'Sardor', lastName: 'Aliyev' })).not.toBe('Sardor Aliyev');
  });
});
