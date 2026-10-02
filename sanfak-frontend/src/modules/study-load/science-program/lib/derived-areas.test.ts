import { describe, expect, it } from 'vitest';
import type { DirectionRef } from '../../study-plan/model/types';
import { derivedAreaHint, derivedAreas, hasOwnAreas } from './derived-areas';

const DAVOLASH: DirectionRef = {
  id: 'dir-1',
  title: 'Davolash ishi',
  knowledgeArea: "900000 – Sog'liqni saqlash va ijtimoiy ta'minot",
  educationArea: "910000 – Sog'liqni saqlash",
};
const PEDIATRIYA: DirectionRef = { ...DAVOLASH, id: 'dir-2', title: 'Pediatriya ishi' };
const FILOLOGIYA: DirectionRef = {
  id: 'dir-3',
  title: 'Filologiya',
  knowledgeArea: "200000 – San'at va gumanitar fanlar",
  educationArea: '230000 – Tillar',
};
const BARE: DirectionRef = { id: 'dir-4', title: 'Sohasiz yo\'nalish' };
const ALL = [DAVOLASH, PEDIATRIYA, FILOLOGIYA, BARE];

describe('hasOwnAreas', () => {
  it("bo'sh massiv, faqat bo'sh qatorlar yoki undefined — o'z qiymati yo'q", () => {
    expect(hasOwnAreas([])).toBe(false);
    expect(hasOwnAreas(['', '   '])).toBe(false);
    expect(hasOwnAreas(undefined)).toBe(false);
  });

  it("kamida bitta to'lgan qator — o'z qiymati bor", () => {
    expect(hasOwnAreas(['', 'Tibbiyot'])).toBe(true);
  });
});

describe('derivedAreas', () => {
  it('tanlash tartibida, takrorsiz (bir xil soha ikki yo\'nalishda — bitta)', () => {
    expect(derivedAreas(['dir-3', 'dir-1', 'dir-2'], ALL, 'educationArea')).toEqual([
      '230000 – Tillar',
      "910000 – Sog'liqni saqlash",
    ]);
  });

  it('apostrof va registr farqi — bitta kalit, birinchi yozuv o\'z shaklida', () => {
    const variant: DirectionRef = { id: 'dir-5', title: 'X', educationArea: '910000 – SOG‘LIQNI SAQLASH ' };
    expect(derivedAreas(['dir-1', 'dir-5'], [...ALL, variant], 'educationArea')).toEqual([
      "910000 – Sog'liqni saqlash",
    ]);
  });

  it("sohasiz yoki ro'yxatda yo'q yo'nalish — tashlanadi", () => {
    expect(derivedAreas(['dir-4', 'dir-404'], ALL, 'knowledgeArea')).toEqual([]);
    expect(derivedAreas(undefined, ALL, 'knowledgeArea')).toEqual([]);
    expect(derivedAreas(['dir-1'], undefined, 'knowledgeArea')).toEqual([]);
  });
});

describe('derivedAreaHint', () => {
  it("o'z qatorlari bo'sh — yo'nalishdan «A, B»", () => {
    expect(derivedAreaHint([''], ['dir-1', 'dir-3'], ALL, 'knowledgeArea')).toBe(
      "900000 – Sog'liqni saqlash va ijtimoiy ta'minot, 200000 – San'at va gumanitar fanlar",
    );
  });

  it("o'z qatori to'la — hint yo'q (PDF o'z qiymatini oladi)", () => {
    expect(derivedAreaHint(['Tibbiyot'], ['dir-1'], ALL, 'knowledgeArea')).toBeNull();
  });

  it("yo'nalish tanlanmagan yoki sohasi yo'q — hint yo'q (PDF «—»)", () => {
    expect(derivedAreaHint([], [], ALL, 'knowledgeArea')).toBeNull();
    expect(derivedAreaHint([], ['dir-4'], ALL, 'knowledgeArea')).toBeNull();
  });
});
