import { describe, expect, it } from 'vitest';
import { skillLabel, skillsText } from './skills';

describe('skillLabel', () => {
  it('🔴 nom va SON birga', () => {
    expect(skillLabel({ skill: 'EKG olish', count: 3 })).toBe('EKG olish ×3');
  });

  it('🔴 `count: 0` — HAQIQIY qiymat, yashirilmaydi', () => {
    expect(skillLabel({ skill: 'EKG olish', count: 0 })).toBe('EKG olish ×0');
  });

  it('soni yo\u2018q (eski yozuv) — faqat nom', () => {
    expect(skillLabel({ skill: 'EKG olish' })).toBe('EKG olish');
  });

  it('`skill: null` — bo‘sh (backend `allow(null)` beradi)', () => {
    expect(skillLabel({ skill: null, count: 2 })).toBe('');
  });

  it('nomsiz yozuv — bo\u2018sh (\u00ab\u00d73\u00bb yolg\u2018iz ma\u2019nosiz)', () => {
    expect(skillLabel({ skill: '', count: 3 })).toBe('');
    expect(skillLabel({ skill: '   ', count: 3 })).toBe('');
  });
});

describe('skillsText', () => {
  it('ro\u2018yxat vergul bilan', () => {
    expect(
      skillsText([
        { skill: 'EKG olish', count: 2 },
        { skill: 'Kateter', count: 1 },
      ]),
    ).toBe('EKG olish ×2, Kateter ×1');
  });

  it('bo\u2018sh / yo\u2018q ro\u2018yxat — bo\u2018sh satr (katak \u00ab\u2014\u00bb ko\u2018rsatadi)', () => {
    expect(skillsText([])).toBe('');
    expect(skillsText(undefined)).toBe('');
    expect(skillsText(null)).toBe('');
  });

  it('nomsiz yozuv ro\u2018yxatdan tushadi, qolgani qoladi', () => {
    expect(skillsText([{ skill: '', count: 1 }, { skill: 'Kateter', count: 4 }])).toBe('Kateter ×4');
  });
});
