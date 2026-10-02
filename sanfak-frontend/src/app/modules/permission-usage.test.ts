import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_PERMISSION_KEYS } from './build-catalog';

const SRC = resolve(__dirname, '../..');

const SCAN_DIRS = ['modules', 'app', 'widgets', 'pages'];

const IGNORE_RE = /\.(test|spec|stories)\.[tj]sx?$/;

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: string[] = [];
  try {
    entries = readdirSync(dir, { recursive: true }) as unknown as string[];
  } catch {
    return out;
  }
  for (const rel of entries) {
    const p = String(rel);
    if (!/\.(ts|tsx)$/.test(p)) continue;
    if (IGNORE_RE.test(p)) continue;
    out.push(resolve(dir, p));
  }
  return out;
}

const FILES = SCAN_DIRS.flatMap((d) => collectFiles(resolve(SRC, d)));

function extractUsedKeys(): Map<string, string[]> {
  const used = new Map<string, string[]>();
  const PATTERNS = [
    /\bpermission:\s*'([a-zA-Z][\w]*:[a-zA-Z][\w]*)'/g,
    /\bpermission:\s*"([a-zA-Z][\w]*:[a-zA-Z][\w]*)"/g,
    /<Can\s+perform=["']([a-zA-Z][\w]*:[a-zA-Z][\w]*)["']/g,
    /\bcan\(\s*'([a-zA-Z][\w]*:[a-zA-Z][\w]*)'\s*\)/g,
    /\bcan\(\s*"([a-zA-Z][\w]*:[a-zA-Z][\w]*)"\s*\)/g,
  ];

  for (const file of FILES) {
    let src = '';
    try {
      src = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const clean = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

    for (const re of PATTERNS) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(clean))) {
        const key = m[1];
        if (!key) continue;
        const where = file.slice(SRC.length + 1).replace(/\\/g, '/');
        const list = used.get(key) ?? [];
        if (!list.includes(where)) list.push(where);
        used.set(key, list);
      }
    }
  }
  return used;
}

const KNOWN_DRIFT = new Set<string>([
  'group:create', 'group:readAll', 'group:update', 'group:delete',
  'report:read',
]);

describe('permission usage — teskari rekonsiliatsiya', () => {
  const used = extractUsedKeys();
  const declared = new Set(ALL_PERMISSION_KEYS);

  it('skanerlash ishladi (fayl va kalit topildi)', () => {
    expect(FILES.length).toBeGreaterThan(50);
    expect(used.size).toBeGreaterThan(20);
  });

  it("kodda ISHLATILAYOTGAN har bir kalit katalogda E'LON QILINGAN", () => {
    const all = [...used.entries()].filter(([key]) => !declared.has(key));
    const known = all.filter(([key]) => KNOWN_DRIFT.has(key));
    const fresh = all
      .filter(([key]) => !KNOWN_DRIFT.has(key))
      .map(([key, files]) => `${key}  ←  ${files.slice(0, 3).join(', ')}`);

    if (known.length) {
      console.warn(
        `[permission-usage] ma'lum drift: ${known.length} ta kalit hamon ` +
          'manifestda e\'lon qilinmagan (KNOWN_DRIFT ro\'yxati).',
      );
    }

    expect(
      fresh,
      'YANGI drift: quyidagi kalitlar kodda ishlatiladi, lekin hech qaysi modul ' +
        'manifestida e\'lon qilinmagan.\n' +
        'Oqibati: runtime gating ishlayveradi (sessiyadan o\'qiydi), lekin kalit ' +
        'registrda yo\'q — dublikat-qopqon va "grant any" validatsiyasi uni ko\'rmaydi.\n' +
        'Tuzatish: kalitni EGASI bo\'lgan modulning `permissions: [...]` ' +
        'ro\'yxatiga qo\'shing (KNOWN_DRIFT ga QO\'SHMANG).\n\n' +
        fresh.join('\n'),
    ).toEqual([]);
  });

  it('KNOWN_DRIFT ro\'yxati eskirmagan (tuzatilgan kalit ro\'yxatda qolmasin)', () => {
    const stale = [...KNOWN_DRIFT].filter((key) => declared.has(key));
    expect(
      stale,
      `Bu kalitlar endi manifestda BOR — KNOWN_DRIFT dan o'chiring: ${stale.join(', ')}`,
    ).toEqual([]);
  });

  it('kanonik format buzilmagan (`section:action`, `_` yo\'q)', () => {
    const bad = [...used.keys()].filter((k) => {
      const [s, a, ...rest] = k.split(':');
      return !s || !a || rest.length > 0 || k.includes('_');
    });
    expect(bad, `Kanonik bo'lmagan kalitlar: ${bad.join(', ')}`).toEqual([]);
  });
});
