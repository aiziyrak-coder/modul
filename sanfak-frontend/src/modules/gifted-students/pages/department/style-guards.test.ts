import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const read = (f: string) => readFileSync(join(here, f), 'utf8');

function styledBody(src: string, name: string): string {
  const start = src.indexOf(`const ${name} = styled`);
  expect(start, `${name} topilmadi`).toBeGreaterThan(-1);
  const open = src.indexOf('`', start);
  const close = src.indexOf('`;', open + 1);
  return src.slice(open + 1, close);
}

describe('D-50 — uzun nom akkordeon qatorini buzmaydi (Criteria.tsx)', () => {
  const src = read('Criteria.tsx');

  it('🔴 TypeLeft kichraya oladi (`min-width: 0`)', () => {
    expect(styledBody(src, 'TypeLeft')).toMatch(/min-width:\s*0/);
  });

  it('🔴 TypeName qisqaradi (`ellipsis`)', () => {
    const body = styledBody(src, 'TypeName');
    expect(body).toMatch(/overflow:\s*hidden/);
    expect(body).toMatch(/text-overflow:\s*ellipsis/);
    expect(body).toMatch(/white-space:\s*nowrap/);
  });

  it('🔴 TypeRight (amal tugmalari) siqilmaydi', () => {
    expect(styledBody(src, 'TypeRight')).toMatch(/flex-shrink:\s*0/);
  });

  it('ikonka va nishon ham siqilmaydi — faqat NOM qisqaradi', () => {
    expect(styledBody(src, 'TypeIcon')).toMatch(/flex-shrink:\s*0/);
    expect(styledBody(src, 'CatCount')).toMatch(/flex-shrink:\s*0/);
  });
});

describe('D-58 — status tabi ajratmasi jadval bilan bir qadamda (Review.tsx)', () => {
  const src = read('Review.tsx');

  it('🔴 FilterTab uslubi STATIK — `$active` ga bog\u2018liq interpolyatsiya yo\u2018q', () => {
    const body = styledBody(src, 'FilterTab');
    expect(
      body.includes('$active'),
      'FilterTab yana `$active` ga bog\u2018langan — har qiymat alohida sinf yaratadi (D-58)',
    ).toBe(false);
  });

  it('🔴 holat `data-active` atributi orqali', () => {
    expect(styledBody(src, 'FilterTab')).toMatch(/\[data-active=['"]true['"]\]/);
    expect(src).toMatch(/data-active=\{filterStatus === key\}/);
  });

  it('faol tab ekranga o\u2018qish uchun ham e\u2018lon qilinadi', () => {
    expect(src).toMatch(/aria-pressed=\{filterStatus === key\}/);
  });

  it('uzun hujjat turi nomi o\u2018raladi (D-50 ning ikkinchi yuzasi)', () => {
    expect(styledBody(src, 'DocTitle')).toMatch(/overflow-wrap:\s*anywhere/);
  });
});

describe('D-63 — qaror qayta ko\'rib chiqiladi (Review.tsx)', () => {
  const src = read('Review.tsx');

  it('«Amallar» ustuni faqat `pending` bilan gate QILINMAGAN', () => {
    expect(src).not.toContain("{row.status === 'pending' && (");
    expect(src).toContain("{row.status === 'pending' ? (");
  });

  it('🔴 TASDIQLANGAN qatorda ball tuzatish tugmasi BOR', () => {
    expect(src).toContain("title={row.status === 'approved' ? 'Ballni tuzatish' : 'Qayta tasdiqlash'}");
  });

  it('RAD ETILGAN qatorda «Rad etish» takrorlanmaydi', () => {
    expect(src).toContain("{row.status !== 'rejected' && (");
  });

  it('batafsil modal footeri ham `pending` ga qulflanmagan', () => {
    expect(src).not.toContain("{viewItem?.status === 'pending' && (");
    expect(src).toContain("{viewItem && (");
  });
});
