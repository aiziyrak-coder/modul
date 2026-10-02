import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SPECIALTY_CATALOG } from './specialty-catalog';

const SEED_FILE = resolve(
  process.cwd(),
  '..',
  'sanfak_backend',
  'seed',
  'methodical-specialties.seed.js',
);

const backendAvailable = existsSync(SEED_FILE);

function extractSeedSpecialties(src: string): Array<[string, string]> {
  const start = src.indexOf('const SPECIALTIES');
  if (start === -1) return [];
  const bracketStart = src.indexOf('[', start);
  if (bracketStart === -1) return [];
  let depth = 0;
  let end = -1;
  for (let i = bracketStart; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return [];
  const block = src.slice(bracketStart, end);
  const out: Array<[string, string]> = [];
  const re = /\[\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    if (m[1] && m[2]) out.push([m[1], m[2]]);
  }
  return out;
}

const seedEntries = backendAvailable
  ? extractSeedSpecialties(readFileSync(SEED_FILE, 'utf8'))
  : [];

describe('SPECIALTY_CATALOG — ichki yaxlitlik', () => {
  it('takrorlanuvchi shifr yo\'q', () => {
    const codes = SPECIALTY_CATALOG.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('har yozuvda code va name bo\'sh emas', () => {
    const invalid = SPECIALTY_CATALOG.filter((s) => !s.code.trim() || !s.name.trim());
    expect(invalid).toEqual([]);
  });
});

describe('SPECIALTY_CATALOG — BE seed bilan sinxronlik', () => {
  it('skanerlash ishladi (backend mavjud bo\'lganda seed o\'qildi)', () => {
    if (!backendAvailable) {
      console.warn(
        `[specialty-catalog] BE seed topilmadi: ${SEED_FILE} — sinxronlik tekshiruvi skip qilindi`,
      );
      return;
    }
    expect(seedEntries.length).toBeGreaterThan(0);
  });

  it.runIf(backendAvailable)('yozuvlar soni BE seed bilan mos', () => {
    expect(SPECIALTY_CATALOG.length).toBe(seedEntries.length);
  });

  it.runIf(backendAvailable)('har shifr va nomi BE seed bilan AYNAN mos', () => {
    const seedMap = new Map(seedEntries);
    const mismatched = SPECIALTY_CATALOG.filter((s) => seedMap.get(s.code) !== s.name);
    expect(
      mismatched.map((s) => `${s.code}: FE="${s.name}" BE="${seedMap.get(s.code) ?? "(yo'q)"}"`),
      "FE va BE katalogi drift qildi — ikkalasini ham yangilang (yoki Faza 3 lug'atiga o'ting).",
    ).toEqual([]);
  });
});
