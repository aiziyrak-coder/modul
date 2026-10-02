import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import dayjs from 'dayjs';
import localeData from 'dayjs/plugin/localeData';
import { describe, expect, it } from 'vitest';
import '@/app/i18n';

dayjs.extend(localeData);

const CYRILLIC = /[Ѐ-ӿ]/;

describe("dayjs 'uz' locale — LOTIN (MD-60)", () => {
  const ld = () => dayjs('2026-08-31').locale('uz').localeData();

  it('hafta kunlari kirill EMAS', () => {
    const days = ld().weekdaysMin().join(' ');
    expect(days).not.toMatch(CYRILLIC);
    expect(days).toContain('Du');
  });

  it('oy nomlari kirill EMAS', () => {
    const months = ld().monthsShort().join(' ');
    expect(months).not.toMatch(CYRILLIC);
    expect(dayjs('2026-08-31').locale('uz').format('MMMM')).toMatch(/Avgust/i);
  });

  it("hafta DUSHANBADAN boshlanadi (inglizcha fallback yakshanbadan boshlardi)", () => {
    expect(ld().firstDayOfWeek()).toBe(1);
  });

  it('GLOBAL locale o‘zgartirilmagan (boshqa modullarga sizmaydi)', () => {
    expect(dayjs.locale()).not.toBe('uz');
  });

  it("reyestrdagi yozuv `name: 'uz'` bilan izchil", () => {
    expect((dayjs.Ls as Record<string, { name?: string }>).uz?.name).toBe('uz');
  });

  it("'uz-latn' nomi ham ishlayveradi (notifications moduli shuni ishlatadi)", () => {
    expect(dayjs('2026-08-31').locale('uz-latn').format('MMMM')).toMatch(/Avgust/i);
  });
});

const SRC = join(process.cwd(), 'src');

const IMPORT_RE = /['"]dayjs\/(?:esm\/)?locale\/uz(?:\.js)?['"]/;

const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx)$/.test(entry)) acc.push(p);
  }
  return acc;
}

const offendingFiles = () =>
  walk(SRC)
    .filter((f) => f !== __filename)
    .filter((f) => IMPORT_RE.test(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => f.slice(SRC.length + 1).split('\\').join('/'));

describe('MD-60 ulanishi (sim) qulflangan', () => {
  it("`app/i18n/index.ts` `./dayjs-locale` ni side-effect sifatida import qiladi", () => {
    const wiring = readFileSync(join(SRC, 'app', 'i18n', 'index.ts'), 'utf8');
    expect(wiring).toMatch(/import\s+['"]\.\/dayjs-locale['"]/);
  });
});

describe('kirill dayjs locale importi taqiqlangan (MD-61)', () => {
  it("hech qaysi fayl 'dayjs/locale/uz' ni import qilmaydi", () => {
    expect(offendingFiles()).toEqual([]);
  });

  it.each([
    ['bare', "import 'dayjs/locale/uz';"],
    ['default', 'import uzCyr from "dayjs/locale/uz";'],
    ['namespace', "import * as uz from 'dayjs/locale/uz';"],
    ['re-export', "export { default } from 'dayjs/locale/uz';"],
    ['require', "const uz = require('dayjs/locale/uz');"],
    ['dinamik', "await import('dayjs/locale/uz')"],
    ['kengaytma bilan', "import 'dayjs/locale/uz.js';"],
    ['esm yo‘li', "import 'dayjs/esm/locale/uz';"],
  ])('kirill importning «%s» shaklini USHLAYDI', (_nom, src) => {
    expect(IMPORT_RE.test(src)).toBe(true);
  });

  it.each([
    ['lotin variant', "import 'dayjs/locale/uz-latn';"],
    ['lotin, default import', "import uzLatn from 'dayjs/locale/uz-latn';"],
    ['boshqa locale', "import 'dayjs/locale/uzbek';"],
  ])('«%s» ni XATO ushlamaydi', (_nom, src) => {
    expect(IMPORT_RE.test(src)).toBe(false);
  });

  it('izohdagi eslatma qoidani buzgan hisoblanmaydi', () => {
    expect(IMPORT_RE.test(stripComments("// import 'dayjs/locale/uz'"))).toBe(false);
    expect(IMPORT_RE.test(stripComments("/* import 'dayjs/locale/uz' */"))).toBe(false);
  });
});
