import { describe, expect, it } from 'vitest';
import { fromNowLocalized } from './dayjs-relative';

const CYRILLIC = /[Ѐ-ӿ]/;

const ago = (ms: number, lang: 'uz' | 'ru' | 'en') =>
  fromNowLocalized(new Date(Date.now() - ms), lang);

const SPANS: Array<[string, number]> = [
  ['soniyalar', 30_000],
  ['daqiqalar', 5 * 60_000],
  ['soatlar', 3 * 3_600_000],
  ['kunlar', 2 * 86_400_000],
  ['oylar', 90 * 86_400_000],
  ['yillar', 730 * 86_400_000],
];

describe('fromNowLocalized — o‘zbek yozuvi (MD-59)', () => {
  it.each(SPANS)('«%s» oralig‘ida kirill CHIQMAYDI', (_label, ms) => {
    const out = ago(ms, 'uz');
    expect(out).not.toMatch(CYRILLIC);
  });

  it('lotin o‘zbekcha so‘z beradi (bo‘sh yoki inglizcha emas)', () => {
    expect(ago(5 * 60_000, 'uz')).toMatch(/daqiqa/);
    expect(ago(3 * 3_600_000, 'uz')).toMatch(/soat/);
    expect(ago(2 * 86_400_000, 'uz')).toMatch(/kun/);
  });
});

describe('fromNowLocalized — boshqa tillar tegilmagan', () => {
  it('rus tili KIRILL bo‘lib qoladi (regressiya qulfi)', () => {
    expect(ago(5 * 60_000, 'ru')).toMatch(CYRILLIC);
  });

  it('ingliz tili lotin va inglizcha qoladi', () => {
    expect(ago(5 * 60_000, 'en')).toMatch(/minutes ago/);
  });
});
