import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

const MUTATION_HOOK =
  /\buse(Create|Update|Delete|Review|Score|Apply|Import|Send)[A-Za-z]*\(\)/;

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.tsx$/.test(entry) && !/\.test\.tsx$/.test(entry)) acc.push(p);
  }
  return acc;
}

const rel = (f: string) => relative(MODULE_DIR, f).split('\\').join('/');
const srcOf = (f: string) => readFileSync(join(MODULE_DIR, f), 'utf8');

const mutatingFiles = () =>
  [...walk(join(MODULE_DIR, 'pages')), ...walk(join(MODULE_DIR, 'components'))]
    .filter((f) => MUTATION_HOOK.test(readFileSync(f, 'utf8')))
    .map(rel)
    .sort();

const EXPECTED = [
  'pages/department/Criteria.tsx',
  'pages/department/Review.tsx',
  'pages/department/Scholarships.tsx',
  'pages/department/StudentForm.tsx',
  'pages/department/Students.tsx',
  'pages/judge/ScholarshipDetail.tsx',
  'pages/scholarships/NomdorForm.tsx',
  'pages/scholarships/RektorDetail.tsx',
  'pages/scholarships/RektorYonalishForm.tsx',
  'pages/scholarships/ScholarshipsByCategory.tsx',
  'pages/student/Activities.tsx',
  'pages/student/Scholarships.tsx',
];

function disabledExpressions(src: string): string[] {
  const out: string[] = [];
  const needle = 'disabled={';
  let i = src.indexOf(needle);
  while (i !== -1) {
    let depth = 1;
    let j = i + needle.length;
    while (j < src.length && depth > 0) {
      if (src[j] === '{') depth += 1;
      else if (src[j] === '}') depth -= 1;
      j += 1;
    }
    out.push(src.slice(i + needle.length, j - 1));
    i = src.indexOf(needle, j);
  }
  return out;
}

function constDeclarations(src: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of src.matchAll(/^\s*const\s+([A-Za-z_$][\w$]*)\s*=\s*(.+?);\s*$/gm)) {
    if (!map.has(m[1]!)) map.set(m[1]!, m[2]!);
  }
  return map;
}

function reachesIsPending(expr: string, decls: Map<string, string>): boolean {
  let cur = expr;
  const seen = new Set<string>();
  for (let round = 0; round < 6; round += 1) {
    if (cur.includes('isPending')) return true;
    let expanded = cur;
    for (const id of new Set(cur.match(/[A-Za-z_$][\w$]*/g) ?? [])) {
      if (seen.has(id) || !decls.has(id)) continue;
      seen.add(id);
      expanded = expanded.replace(new RegExp(`\\b${id}\\b`, 'g'), `(${decls.get(id)})`);
    }
    if (expanded === cur) return false;
    cur = expanded;
  }
  return cur.includes('isPending');
}

describe('ikki marta yuborish qo\u2018rig\u2018i (D-57 / D-78)', () => {
  it('mutatsiya chaqiradigan fayllar ro\u2018yxati kutilganidek', () => {
    expect(mutatingFiles()).toEqual(EXPECTED);
  });

  it('bo\u2018sh sikl yashil qolmaydi', () => {
    expect(mutatingFiles().length).toBeGreaterThan(0);
  });

  it.each(EXPECTED)('%s da `disabled` HAQIQATAN `isPending` ga borib taqaladi', (f) => {
    const src = srcOf(f);
    const decls = constDeclarations(src);
    const wired = disabledExpressions(src).filter((e) => reachesIsPending(e, decls));
    expect(wired.length).toBeGreaterThan(0);
  });
});

describe('qulf o\u2018zi ishlaydi', () => {
  it('mutatsiyasiz sahifa ro\u2018yxatga tushmaydi', () => {
    expect(mutatingFiles()).not.toContain('pages/student/Profile.tsx');
  });

  it('naqsh haqiqiy hook chaqiruvini ushlaydi, matnni emas', () => {
    expect(MUTATION_HOOK.test('const m = useCreateScholarship();')).toBe(true);
    expect(MUTATION_HOOK.test('useUpdateStudent')).toBe(false);
    expect(MUTATION_HOOK.test('useStudents()')).toBe(false);
  });

  it('yechuvchi ZANJIRNI kuzatadi, shunchaki matn qidirmaydi', () => {
    const decls = new Map([
      ['canSave', 'Boolean(form.title) && !saving'],
      ['saving', 'createAchievement.isPending || updateAchievement.isPending'],
    ]);
    expect(reachesIsPending('!canSave', decls)).toBe(true);
    const reverted = new Map([
      ['canSave', 'Boolean(form.title)'],
      ['saving', 'createAchievement.isPending || updateAchievement.isPending'],
    ]);
    expect(reachesIsPending('!canSave', reverted)).toBe(false);
  });

  it('bog\u2018lanmagan bayroq yetarli EMAS', () => {
    const decls = new Map([['busy', 'mut.isPending']]);
    expect(reachesIsPending('!form.title', decls)).toBe(false);
  });
});
