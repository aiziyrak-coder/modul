import { describe, expect, it } from 'vitest';
import {
  SESSIONS_TAB_PATH,
  parseJournalTab,
  sessionDetailPath,
  withJournalTab,
} from './journal-tab';

describe('F1-Q10 — Jurnal tabi URL’da', () => {
  it.each([
    [null, true, 'kunlik'],
    ['', true, 'kunlik'],
    ['kunlik', true, 'kunlik'],
    ['tarix', true, 'tarix'],
    ['tarix', false, 'tarix'],
    ['mashgulotlar', true, 'mashgulotlar'],
    ['mashgulotlar', false, 'kunlik'],
    ['MASHGULOTLAR', true, 'kunlik'],
    ['boshqa', true, 'kunlik'],
  ] as const)('parseJournalTab(%j, canAnnounce=%s) → %s', (raw, canAnnounce, expected) => {
    expect(parseJournalTab(raw, canAnnounce)).toBe(expected);
  });

  it('standart tab URL’ga yozilmaydi, boshqa parametrlar saqlanadi, kirish obyekti o‘zgarmaydi', () => {
    const src = new URLSearchParams('tab=mashgulotlar&x=1');

    expect(withJournalTab(src, 'kunlik').toString()).toBe('x=1');
    expect(withJournalTab(src, 'tarix').toString()).toBe('tab=tarix&x=1');
    expect(withJournalTab(new URLSearchParams('x=1'), 'mashgulotlar').toString()).toBe(
      'x=1&tab=mashgulotlar',
    );
    expect(src.toString()).toBe('tab=mashgulotlar&x=1');
  });

  it('yo‘llar: ro‘yxat — Jurnal tabi, tafsilot — Jurnal ostida (menyuda «Jurnal» belgilanadi)', () => {
    expect(SESSIONS_TAB_PATH).toBe('/residency/davomat?tab=mashgulotlar');
    expect(sessionDetailPath('s1')).toBe('/residency/davomat/mashgulot/s1');
    const url = new URL(SESSIONS_TAB_PATH, 'http://x');
    expect(parseJournalTab(url.searchParams.get('tab'), true)).toBe('mashgulotlar');
  });
});
