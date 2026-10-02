import { describe, it, expect } from 'vitest';
import { buildDalolatnomaHtml, safeFileName } from './dalolatnoma-doc';
import type { DalolatnomaItem } from './dalolatnoma-template';

const items: DalolatnomaItem[] = [
  { no: 1, text: 'Yo‘llanma xati talablarga muvofiq.', docLabel: 'Yo‘llanma xati', memberName: 'Toshmatov R.' },
  { no: 2, text: 'Pasport nusxasi to‘liq.', docLabel: 'Pasport', memberName: 'Toshmatov R.' },
];

const input = {
  heading: ['Institut dastlabki ekspertiza guruhining', '(24.08.2026-yildagi dalolatnomasi)', 'XULOSASI'],
  intro: 'Institut mustaqil izlanuvchisi Orinbayev J.T.ning hujjatlari bo‘yicha:',
  items,
  finalConclusion: [
    'Xulosa qilib:',
    '1. Hujjatlar talablarga muvofiq rasmiylashtirilganligini tasdiqlaydi.',
    '',
    'O‘quv ishlari bo‘yicha prorektor\t\t\tU.Boltaboyev',
    '',
    'Ijrochi: A.R.Muradimova',
    '+998916084289',
  ].join('\n'),
};

describe('buildDalolatnomaHtml', () => {
  it('sarlavha, kirish va raqamli bandlarni chiqaradi', () => {
    const html = buildDalolatnomaHtml(input);
    expect(html).toContain('XULOSASI');
    expect(html).toContain('mustaqil izlanuvchisi');
    expect(html).toContain('№ 1.');
    expect(html).toContain('№ 2.');
  });

  it('imzo bloki — prorektor va ijrochi hujjatga tushadi', () => {
    const html = buildDalolatnomaHtml(input);
    expect(html).toContain('O‘quv ishlari bo‘yicha prorektor');
    expect(html).toContain('U.Boltaboyev');
    expect(html).toContain('Ijrochi: A.R.Muradimova');
    expect(html).toContain('+998916084289');
  });

  it('yakuniy xulosa pre-wrap bilan chiqadi (tab saqlanadi)', () => {
    const html = buildDalolatnomaHtml(input);
    expect(html).toContain('white-space: pre-wrap');
    expect(html).toContain('class="final"');
    expect(html).toContain('prorektor\t\t\tU.Boltaboyev');
  });

  it('A4 sahifa sozlamasi beriladi', () => {
    expect(buildDalolatnomaHtml(input)).toContain('@page { size: A4;');
  });

  it('HTML belgilarini xavfsizlantiradi', () => {
    const html = buildDalolatnomaHtml({ ...input, intro: '<script>alert(1)</script>' });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('safeFileName', () => {
  it('kengaytmasiz — brauzer PDF nomini `<title>`dan oladi', () => {
    expect(safeFileName('Bolalar kardiologiyasi')).toBe('Dalolatnoma_Bolalar_kardiologiyasi');
  });

  it('fayl nomida taqiqlangan belgilarni olib tashlaydi', () => {
    expect(safeFileName('a/b:c*d?e"f<g>h|i')).toBe('Dalolatnoma_abcdefghi');
  });

  it('bo‘sh sarlavhada zaxira nom ishlatiladi', () => {
    expect(safeFileName('   ')).toBe('Dalolatnoma_ilmiy_ish');
  });
});
