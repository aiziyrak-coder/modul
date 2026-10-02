import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_PERMISSION_KEYS } from './build-catalog';

const KNOWN_CUSTOM_ACTIONS = new Set<string>(['verifyDoc']);

function isCanonicalKey(key: string): boolean {
  const [section, action, ...rest] = key.split(':');
  return !!section && !!action && rest.length === 0 && !key.includes('_');
}

function extractBlockValues(src: string, blockName: string): Set<string> {
  const noComments = src.replace(/\/\/[^\n]*/g, '');
  const start = noComments.indexOf(`${blockName}:`);
  if (start === -1) return new Set();
  const braceStart = noComments.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (let i = braceStart; i < noComments.length; i++) {
    if (noComments[i] === '{') depth++;
    else if (noComments[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const block = noComments.slice(braceStart, end);
  const values = new Set<string>();
  for (const m of block.matchAll(/"([^"]+)"/g)) {
    if (m[1]) values.add(m[1]);
  }
  return values;
}

interface BackendCatalog {
  modules: string[];
  actions: string[];
  source?: string;
}

const ARTIFACT = resolve(process.cwd(), 'src', 'app', 'modules', 'backend-permission-catalog.json');
const artifactExists = existsSync(ARTIFACT);
const catalog: BackendCatalog = artifactExists
  ? (JSON.parse(readFileSync(ARTIFACT, 'utf8')) as BackendCatalog)
  : { modules: [], actions: [] };

const MODULES = new Set(catalog.modules ?? []);
const ACTIONS = new Set(catalog.actions ?? []);

const BACKEND_CONSTANTS = resolve(
  process.cwd(),
  '..',
  'sanfak_backend',
  'src',
  'config',
  'constants.js',
);
const backendAvailable = existsSync(BACKEND_CONSTANTS);

describe('permission catalog — format', () => {
  it('har key `section:action` (camelCase, `_` yo`q)', () => {
    const bad = ALL_PERMISSION_KEYS.filter((key) => !isCanonicalKey(key));
    expect(bad, `Noto'g'ri formatdagi permission key'lar: ${bad.join(', ')}`).toEqual([]);
  });

  it('format predikati noto`g`ri key`larni rad etadi (no-op emasligi isboti)', () => {
    expect(isCanonicalKey('country:readAll')).toBe(true);
    expect(isCanonicalKey('country_readAll')).toBe(false);
    expect(isCanonicalKey('country')).toBe(false);
    expect(isCanonicalKey('a:b:c')).toBe(false);
  });
});

describe('permission catalog — backend artefakti', () => {
  it('artefakt MAVJUD (yo`q bo`lsa darvoza o`chgan — bu xato, skip emas)', () => {
    expect(
      artifactExists,
      `Backend katalog artefakti topilmadi: ${ARTIFACT}\n` +
        `Yarating: sanfak_backend da \`yarn gen:catalog\` → so'ng artefaktni SHU repo'ga commit qiling.\n` +
        `Bu fayl bo'lmasa FE↔BE permission moslik tekshiruvi umuman bajarilmaydi (#11b).`,
    ).toBe(true);
  });

  it('artefakt bo`sh emas (bo`sh katalog hamma narsani o`tkazib yuborardi)', () => {
    expect(MODULES.size, 'Artefaktdagi MODULES bo`sh — qayta generatsiya qiling').toBeGreaterThan(0);
    expect(ACTIONS.size, 'Artefaktdagi ACTIONS bo`sh — qayta generatsiya qiling').toBeGreaterThan(0);
  });
});

describe('permission catalog — backend bilan moslik (artefakt orqali, CI`da ham ishlaydi)', () => {
  it('har `section` ∈ backend MODULES', () => {
    const unknown = [...new Set(ALL_PERMISSION_KEYS.map((k) => k.split(':')[0] ?? ''))].filter(
      (section) => !MODULES.has(section),
    );
    expect(
      unknown,
      `Backend katalogida yo'q section'lar (seed kerak yoki nom xato): ${unknown.join(', ')}`,
    ).toEqual([]);
  });

  it('har `action` ∈ backend ACTIONS (+ ruxsat etilgan custom)', () => {
    const unknown = [...new Set(ALL_PERMISSION_KEYS.map((k) => k.split(':')[1] ?? ''))].filter(
      (action) => action !== '' && !ACTIONS.has(action) && !KNOWN_CUSTOM_ACTIONS.has(action),
    );
    expect(
      unknown,
      `Backend katalogida yo'q action'lar (backendda seed qiling yoki allowlist'ga qo'shing): ${unknown.join(', ')}`,
    ).toEqual([]);
  });

  it('moslik tekshiruvi shartsiz — artefakt bor ekan hech qachon skip bo`lmaydi', () => {
    expect(artifactExists, 'Artefakt yo`q — moslik tekshiruvi asossiz qoldi').toBe(true);
    expect(ALL_PERMISSION_KEYS.length, 'Manifest katalogi bo`sh — tekshiradigan narsa yo`q').toBeGreaterThan(0);
  });
});

describe('permission catalog — artefakt yangiligi', () => {
  it.runIf(backendAvailable)('artefakt jonli `constants.js` bilan bir xil', () => {
    const src = readFileSync(BACKEND_CONSTANTS, 'utf8');
    const liveModules = [...extractBlockValues(src, 'MODULES')].sort();
    const liveActions = [...extractBlockValues(src, 'ACTIONS')].sort();

    const yangiModul = liveModules.filter((m) => !MODULES.has(m));
    const yoqModul = [...MODULES].filter((m) => !liveModules.includes(m));
    const yangiAction = liveActions.filter((a) => !ACTIONS.has(a));
    const yoqAction = [...ACTIONS].filter((a) => !liveActions.includes(a));

    expect(
      { yangiModul, yoqModul, yangiAction, yoqAction },
      `Artefakt ESKIRGAN. sanfak_backend da \`yarn gen:catalog\` ishga tushiring va ` +
        `yangilangan \`backend-permission-catalog.json\` ni SHU repo'ga commit qiling.`,
    ).toEqual({ yangiModul: [], yoqModul: [], yangiAction: [], yoqAction: [] });
  });

  it('yangilik tekshiruvi skip bo`lsa ham MOSLIK tekshirilgan bo`ladi', () => {
    if (!backendAvailable) {
      console.warn(
        `[permission-catalog] jonli backend topilmadi: ${BACKEND_CONSTANTS} — ` +
          `faqat YANGILIK tekshiruvi skip qilindi. Moslik tekshiruvi artefakt orqali BAJARILDI.`,
      );
    }
    expect(artifactExists).toBe(true);
  });
});
