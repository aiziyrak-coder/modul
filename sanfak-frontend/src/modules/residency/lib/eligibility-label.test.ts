import { describe, expect, it } from 'vitest';
import { eligibilityHoursLabel } from './eligibility-label';
import type { EligibilityWindow } from '../api/types';

const ALL_YEARS = 'Sababsiz soat (barcha yillar)';
const CURRENT_NO_TITLE = 'Sababsiz soat (joriy o‘quv yili)';
const EXPLICIT = 'Sababsiz soat (tanlangan davr)';

const academicYear = (title: string | null): EligibilityWindow => ({
  source: 'academicYear',
  academicYear: title,
  from: '2026-09-01T00:00:00.000Z',
  to: '2027-08-31T23:59:59.000Z',
});

const explicit = (title: string | null = null): EligibilityWindow => ({
  source: 'explicit',
  academicYear: title,
  from: '2024-01-01T00:00:00.000Z',
  to: null,
});

describe('eligibilityHoursLabel — eski backend (`window` yo‘q)', () => {
  it.each([undefined, null])('%s → «barcha yillar» (GCX-Q6)', (w) => {
    expect(eligibilityHoursLabel(w)).toBe(ALL_YEARS);
  });

  it('argumentsiz → «barcha yillar»', () => {
    expect(eligibilityHoursLabel()).toBe(ALL_YEARS);
  });
});

describe('eligibilityHoursLabel — joriy o‘quv yili (ATW-Q1, ATW-Q7)', () => {
  it.each([
    ['2026/2027', 'Sababsiz soat (joriy o‘quv yili, 2026/2027)'],
    ['2025/2026', 'Sababsiz soat (joriy o‘quv yili, 2025/2026)'],
  ])('%s → AYNAN %s', (title, label) => {
    expect(eligibilityHoursLabel(academicYear(title))).toBe(label);
  });

  it.each([
    ['2026-2027'],
    [''],
    [null],
    ['26/27'],
    [' 2026/2027'],
    ['2026/2027 '],
    ['2026/2027<b>'],
    [2026],
  ])('buzuq titul %j → titulsiz «joriy o‘quv yili», qiymat chiqmaydi', (title) => {
    const out = eligibilityHoursLabel(academicYear(title as string | null));
    expect(out).toBe(CURRENT_NO_TITLE);
  });
});

describe('eligibilityHoursLabel — aniq sana (ATW-Q2, himoya shoxi)', () => {
  it('`explicit` → «tanlangan davr»', () => {
    expect(eligibilityHoursLabel(explicit())).toBe(EXPLICIT);
  });

  it('`explicit` + to‘g‘ri titul ham → «tanlangan davr», «joriy» DEMAYDI', () => {
    const out = eligibilityHoursLabel(explicit('2026/2027'));
    expect(out).toBe(EXPLICIT);
    expect(out).not.toContain('joriy');
  });
});

describe('eligibilityHoursLabel — tanilmagan `window`', () => {
  it('noma’lum `source`, titul yo‘q → izohsiz «Sababsiz soat»', () => {
    const w = { source: 'rolling', academicYear: null, from: null, to: null };
    expect(eligibilityHoursLabel(w as unknown as EligibilityWindow)).toBe('Sababsiz soat');
  });

  it('noma’lum `source`, to‘g‘ri titul → titul bilan (titul — server faktidir)', () => {
    const w = { source: 'rolling', academicYear: '2026/2027', from: null, to: null };
    expect(eligibilityHoursLabel(w as unknown as EligibilityWindow)).toBe(
      'Sababsiz soat (joriy o‘quv yili, 2026/2027)',
    );
  });
});

describe('eligibilityHoursLabel — tipografiya (F1-Q4)', () => {
  it.each([
    ['o‘quv yili', academicYear('2026/2027')],
    ['titulsiz', academicYear(null)],
  ])('%s: `‘` U+2018 bor, ASCII apostrof yo‘q', (_k, w) => {
    const out = eligibilityHoursLabel(w);
    expect(out).toContain('o‘quv');
    expect(out).not.toContain("'");
  });

  it.each([undefined, explicit()])('qolgan yorliqlarda ham ASCII apostrof yo‘q', (w) => {
    expect(eligibilityHoursLabel(w)).not.toContain("'");
  });
});
