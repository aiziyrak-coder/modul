import { describe, expect, it } from 'vitest';
import { ELLIPSIS, MAX_SLOTS, pageWindow } from './pagination';

describe('pageWindow — eni barqaror', () => {
  it('🔴 katta ro\u2018yxatda katak soni O\u2018SMAYDI', () => {
    for (const total of [8, 14, 50, 500, 100_000]) {
      expect(pageWindow(1, total)).toHaveLength(MAX_SLOTS);
      expect(pageWindow(Math.ceil(total / 2), total)).toHaveLength(MAX_SLOTS);
      expect(pageWindow(total, total)).toHaveLength(MAX_SLOTS);
    }
  });

  it('ro\u2018yxat o\u2018sganda boshqaruv KICHRAYMAYDI ham', () => {
    expect(pageWindow(1, 7)).toHaveLength(7);
    expect(pageWindow(1, 8)).toHaveLength(7);
  });

  it('kichik ro\u2018yxat — oraliqsiz to\u2018liq ro\u2018yxat', () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(2, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe('pageWindow — shakl', () => {
  it('boshida', () => {
    expect(pageWindow(1, 20)).toEqual([1, 2, 3, 4, 5, ELLIPSIS, 20]);
    expect(pageWindow(4, 20)).toEqual([1, 2, 3, 4, 5, ELLIPSIS, 20]);
  });

  it('o\u2018rtada', () => {
    expect(pageWindow(10, 20)).toEqual([1, ELLIPSIS, 9, 10, 11, ELLIPSIS, 20]);
  });

  it('oxirida', () => {
    expect(pageWindow(20, 20)).toEqual([1, ELLIPSIS, 16, 17, 18, 19, 20]);
    expect(pageWindow(17, 20)).toEqual([1, ELLIPSIS, 16, 17, 18, 19, 20]);
  });

  it('joriy sahifa HAR DOIM ro\u2018yxatda', () => {
    for (let c = 1; c <= 20; c += 1) {
      expect(pageWindow(c, 20)).toContain(c);
    }
  });

  it('qo\u2018shnilari ham ko\u2018rinadi (bir bosishda yetish)', () => {
    for (let c = 2; c <= 19; c += 1) {
      const w = pageWindow(c, 20);
      expect(w).toContain(c - 1);
      expect(w).toContain(c + 1);
    }
  });
});

describe('pageWindow — shox chegaralari', () => {
  it('bosh ↔ o\u2018rta chegarasi (c = 4 va 5)', () => {
    expect(pageWindow(4, 20)).toEqual([1, 2, 3, 4, 5, ELLIPSIS, 20]);
    expect(pageWindow(5, 20)).toEqual([1, ELLIPSIS, 4, 5, 6, ELLIPSIS, 20]);
  });

  it('o\u2018rta ↔ quyruq chegarasi (c = 16 va 17)', () => {
    expect(pageWindow(16, 20)).toEqual([1, ELLIPSIS, 15, 16, 17, ELLIPSIS, 20]);
    expect(pageWindow(17, 20)).toEqual([1, ELLIPSIS, 16, 17, 18, 19, 20]);
  });

  it('🔴 oraliq kamida IKKI sahifani yashiradi', () => {
    for (let total = 8; total <= 40; total += 1) {
      for (let c = 1; c <= total; c += 1) {
        const w = pageWindow(c, total);
        w.forEach((slot, i) => {
          if (slot !== ELLIPSIS) return;
          const before = w[i - 1];
          const after = w[i + 1];
          if (typeof before === 'number' && typeof after === 'number') {
            expect(after - before).toBeGreaterThan(2);
          }
        });
      }
    }
  });

  it('almashtirish katak sonini O\u2018ZGARTIRMAYDI', () => {
    for (let total = 8; total <= 40; total += 1) {
      for (let c = 1; c <= total; c += 1) {
        expect(pageWindow(c, total)).toHaveLength(MAX_SLOTS);
      }
    }
  });
});

describe('pageWindow — chegaraviy holatlar', () => {
  it('sahifa yo\u2018q — bo\u2018sh massiv', () => {
    expect(pageWindow(1, 0)).toEqual([]);
    expect(pageWindow(1, -3)).toEqual([]);
    expect(pageWindow(1, Number.NaN)).toEqual([]);
  });

  it('joriy sahifa chegaradan tashqarida — qisiladi, yiqilmaydi', () => {
    expect(pageWindow(99, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(0, 20)).toEqual([1, 2, 3, 4, 5, ELLIPSIS, 20]);
    expect(pageWindow(-4, 20)).toEqual([1, 2, 3, 4, 5, ELLIPSIS, 20]);
  });

  it('kasr qiymatlar — butunga keltiriladi', () => {
    expect(pageWindow(2.7, 3.9)).toEqual([1, 2, 3]);
  });

  it('hech qachon takror sahifa qaytarmaydi', () => {
    for (let total = 1; total <= 40; total += 1) {
      for (let c = 1; c <= total; c += 1) {
        const nums = pageWindow(c, total).filter((s): s is number => typeof s === 'number');
        expect(new Set(nums).size).toBe(nums.length);
      }
    }
  });

  it('sahifalar HAR DOIM o\u2018sish tartibida', () => {
    for (let total = 1; total <= 40; total += 1) {
      for (let c = 1; c <= total; c += 1) {
        const nums = pageWindow(c, total).filter((s): s is number => typeof s === 'number');
        expect([...nums].sort((a, b) => a - b)).toEqual(nums);
      }
    }
  });
});
