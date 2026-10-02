import { describe, expect, it } from 'vitest';
import {
  phoneToNational,
  phoneToDisplay,
  phoneToStored,
  isPhoneComplete,
  jshshirMask,
  isJshshirComplete,
  moneyToRaw,
  moneyToDisplay,
  moneyToNumber,
} from './masks';

describe('telefon maskasi', () => {
  it('davlat kodini olib tashlaydi (foydalanuvchi to\'liq raqam qo\'ysa ham)', () => {
    expect(phoneToNational('+998901234567')).toBe('901234567');
    expect(phoneToNational('998901234567')).toBe('901234567');
    expect(phoneToNational('901234567')).toBe('901234567');
  });

  it('raqam bo\'lmagan belgilarni tashlaydi', () => {
    expect(phoneToNational('+998 (90) 123-45-67')).toBe('901234567');
  });

  it('9 ta raqamdan ortig\'ini qirqadi', () => {
    expect(phoneToNational('9012345678888')).toBe('901234567');
  });

  it('davlat kodini IKKI marta yemaydi (99 operator kodi)', () => {
    expect(phoneToNational('+998998123456')).toBe('998123456');
    expect(phoneToDisplay('+998998123456')).toBe('+998 99 812-34-56');
  });

  it('to\'liq raqamni fjsti formatida ko\'rsatadi', () => {
    expect(phoneToDisplay('901234567')).toBe('+998 90 123-45-67');
  });

  it('yarim kiritilgan raqamda ham sinmaydi', () => {
    expect(phoneToDisplay('9')).toBe('+998 9');
    expect(phoneToDisplay('90')).toBe('+998 90');
    expect(phoneToDisplay('9012')).toBe('+998 90 12');
    expect(phoneToDisplay('901234')).toBe('+998 90 123-4');
  });

  it('bo\'sh qiymat — bo\'sh satr (placeholder ko\'rinsin)', () => {
    expect(phoneToDisplay('')).toBe('');
    expect(phoneToDisplay(null)).toBe('');
    expect(phoneToDisplay(undefined)).toBe('');
  });

  it('saqlash shakli ixcham — formatlangan matn EMAS', () => {
    expect(phoneToStored('+998 90 123-45-67')).toBe('+998901234567');
    expect(phoneToStored('')).toBe('');
  });

  it('to\'liqlik tekshiruvi', () => {
    expect(isPhoneComplete('+998901234567')).toBe(true);
    expect(isPhoneComplete('90123456')).toBe(false);
  });
});

describe('JSHSHIR maskasi', () => {
  it('faqat raqam qoldiradi', () => {
    expect(jshshirMask('4020-0000/0000 01')).toBe('40200000000001');
  });

  it('14 xonadan ortig\'ini qirqadi', () => {
    expect(jshshirMask('123456789012345678')).toBe('12345678901234');
  });

  it('GURUHLASHTIRILMAYDI — login maydonida nusxalash buzilmasin', () => {
    expect(jshshirMask('40200000000001')).toBe('40200000000001');
    expect(jshshirMask('40200000000001')).not.toContain(' ');
  });

  it('to\'liqlik tekshiruvi', () => {
    expect(isJshshirComplete('40200000000001')).toBe(true);
    expect(isJshshirComplete('402000')).toBe(false);
  });
});

describe('pul maskasi', () => {
  it('ming ajratgich qo\'yadi', () => {
    expect(moneyToDisplay('1500000')).toBe('1 500 000');
    expect(moneyToDisplay('999')).toBe('999');
    expect(moneyToDisplay('1000')).toBe('1 000');
  });

  it('ajratgich UZLUKSIZ bo\'shliq — raqam ikki qatorga sinmaydi', () => {
    expect(moneyToDisplay('1500000')).not.toContain(' ');
    expect(moneyToDisplay('1500000')).toContain(' ');
  });

  it('boshidagi keraksiz nollarni olib tashlaydi', () => {
    expect(moneyToRaw('000123')).toBe('123');
    expect(moneyToRaw('0')).toBe('0');
  });

  it('raqam bo\'lmagan belgilarni tashlaydi', () => {
    expect(moneyToRaw('1 500 000 so\'m')).toBe('1500000');
  });

  it('backendga son qaytaradi, bo\'sh bo\'lsa null', () => {
    expect(moneyToNumber('1 500 000')).toBe(1500000);
    expect(moneyToNumber('')).toBeNull();
    expect(moneyToNumber(null)).toBeNull();
  });
});
