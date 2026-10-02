import { describe, expect, it } from 'vitest';
import { CAT_POINTS_MAX, catPointsError, catPointsValid } from './category-points';

describe('catPointsError', () => {
  it('chegaradan yuqori qiymat XATO beradi (jimgina 100 ga aylanmaydi)', () => {
    expect(catPointsError('125')).toBe(`Ball 1 va ${CAT_POINTS_MAX} orasida bo'lishi kerak`);
    expect(catPointsValid('125')).toBe(false);
  });

  it('0 va manfiy qiymat xato', () => {
    expect(catPointsError('0')).not.toBeNull();
    expect(catPointsError('-5')).not.toBeNull();
  });

  it('oraliqdagi qiymat (kasr ham) yaroqli', () => {
    expect(catPointsError('1')).toBeNull();
    expect(catPointsError('2.5')).toBeNull();
    expect(catPointsError(String(CAT_POINTS_MAX))).toBeNull();
    expect(catPointsValid('2.5')).toBe(true);
  });

  it('son bo\u2018lmagan kirish xato', () => {
    expect(catPointsError('abc')).toBe('Faqat son kiriting');
  });

  it('bo\u2018sh maydon xato KO\u2018RSATMAYDI, lekin yaroqli ham emas', () => {
    expect(catPointsError('')).toBeNull();
    expect(catPointsValid('')).toBe(false);
  });
});
