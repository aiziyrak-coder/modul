import { describe, expect, it } from 'vitest';
import { deriveWeekStats, type WeekStatInput } from './derive-week-stats';

const STATS: WeekStatInput[] = [
  { _id: 'st-n', key: ' ', slug: 'nazariy', title: "Nazariy va amaliy ta'lim" },
  { _id: 'st-a', key: 'A', slug: 'attestatsiyalar', title: 'Attestatsiyalar' },
  { _id: 'st-k', key: 'K', slug: 'kurs', title: 'Kurs ishi' },
  { _id: 'st-m', key: 'M', slug: 'malakaviy', title: 'Malakaviy amaliyot' },
  { _id: 'st-d', key: 'D', slug: 'davlat', title: 'Yakuniy davlat attestatsiyasi' },
  { _id: 'st-t', key: 'T', slug: 'tatil', title: "Ta'til" },
  { _id: 'st-g', key: 'G', slug: 'gpa', title: "GPA ko'rsatkichini hisoblash" },
  { _id: 'st-h', key: null, slug: 'hammasi', title: 'Hammasi' },
];

function weeksOf(letters: Record<number, string>, size = 52): Record<string, string | null> {
  const weeks: Record<string, string | null> = {};
  for (let n = 1; n <= size; n += 1) {
    weeks[String(n)] = letters[n] ?? null;
  }
  return weeks;
}

const DEMO_LETTERS: Record<number, string> = {
  1: 'K',
  17: 'T',
  18: 'T',
  19: 'A',
  20: 'A',
  36: 'A',
  37: 'A',
  38: 'M',
  39: 'M',
  40: 'M',
  41: 'M',
  42: 'A',
  43: 'T',
  44: 'T',
  45: 'T',
  46: 'T',
  47: 'T',
  48: 'T',
  49: 'T',
  50: 'T',
  51: 'G',
  52: 'T',
};

describe('deriveWeekStats', () => {
  it('demo kurs qatori — har statistika harfi turgan haftalar soniga teng', () => {
    const { statistics, total } = deriveWeekStats(weeksOf(DEMO_LETTERS), STATS);

    expect(statistics).toEqual({
      'st-n': 30,
      'st-a': 5,
      'st-k': 1,
      'st-m': 4,
      'st-d': 0,
      'st-t': 11,
      'st-g': 1,
      'st-h': 52,
    });
    expect(total).toBe(52 - 11 - 1);
  });

  it('🔴 OXIRGI harfdan keyingi bo`sh kataklar yilga kirmaydi (48/52)', () => {
    const letters = { ...DEMO_LETTERS };
    delete letters[49];
    delete letters[50];
    delete letters[51];
    delete letters[52];

    const { statistics, total } = deriveWeekStats(weeksOf(letters), STATS);

    expect(statistics['st-h']).toBe(48);
    expect(statistics['st-n']).toBe(30);
    expect(statistics['st-t']).toBe(8);
    expect(statistics['st-g']).toBe(0);
    expect(total).toBe(48 - 8 - 0);
  });

  it('bo`sh qatorda hammasi 0 (birorta ham harf yo`q)', () => {
    const { statistics, total } = deriveWeekStats(weeksOf({}), STATS);

    expect(statistics['st-h']).toBe(0);
    expect(statistics['st-n']).toBe(0);
    expect(total).toBe(0);
  });

  it('"Hammasi" slug`siz, faqat sarlavha bo`yicha ham topiladi (eski hujjat)', () => {
    const legacy: WeekStatInput[] = [
      { _id: 'st-n', key: ' ', slug: '', title: "Nazariy va amaliy ta'lim" },
      { _id: 'st-h', key: null, slug: 'h', title: 'Hammasi' },
    ];

    const { statistics } = deriveWeekStats(weeksOf(DEMO_LETTERS), legacy);

    expect(statistics['st-h']).toBe(52);
    expect(statistics['st-n']).toBe(30);
  });
});
