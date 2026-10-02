import { describe, expect, it } from 'vitest';

const sources = import.meta.glob('./**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const stripComments = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => {
      const s = line.trim();
      return !s.startsWith('//') && !s.startsWith('*');
    })
    .join('\n');

const codeFiles = Object.entries(sources).filter(([p]) => !p.includes('.test.'));

describe('4.8 — real data kafolati', () => {
  it('modulda kod fayllari bor (bekorga o`tmasin)', () => {
    expect(codeFiles.length).toBeGreaterThan(20);
  });

  it('mock qatlami YO`Q (USE_MOCK / mock-store)', () => {
    const offenders = codeFiles
      .filter(([, src]) => /USE_MOCK|mockStore|mock-store/.test(stripComments(src)))
      .map(([p]) => p);
    expect(offenders).toEqual([]);
  });

  it('ariza hooklari to`g`ridan backend endpointiga boradi', () => {
    const api = sources['./api/foreign-admission-api.ts'];
    expect(api).toBeDefined();
    expect(api).toContain('/international-admission');
    expect(api).toContain('/stats');
    expect(api).toContain('/countries');
  });

  it('dashboard butun ro`yxatni yuklab, brauzerda yig`maydi', () => {
    const page = stripComments(sources['./pages/dashboard-page.tsx'] ?? '');
    expect(page).toContain('useApplicantStats');
    expect(page).not.toContain('useAllApplicants');
    expect(page).not.toContain('buildReport');
  });

  it('davlatlar va o`quv yillari ro`yxati kodda YOZILMAGAN', () => {
    const filters = stripComments(sources['./widgets/applicants-filters.tsx'] ?? '');
    expect(filters).toContain('useApplicantCountries');

    const offenders = codeFiles
      .filter(([, src]) => /academicYearOptions/.test(stripComments(src)))
      .map(([p]) => p);
    expect(offenders).toEqual([]);

    ['./pages/seasons-page.tsx', './pages/messages-page.tsx', './components/season-form-modal/index.tsx']
      .forEach((path) => {
        expect(stripComments(sources[path] ?? ''), path).toContain('useAcademicYears');
      });
  });

  it('ta`lim tuzilmasi Select`lari ma`lumotnoma endpointidan to`ladi', () => {
    const modal = stripComments(sources['./components/season-form-modal/index.tsx'] ?? '');
    expect(modal).toContain('useAllLangRecords');
    expect(modal).toContain('REF_ROOTS.directions');
    expect(modal).toContain('REF_ROOTS.educationForms');
    expect(modal).toContain('REF_ROOTS.educationLanguages');
  });

  it('ma`lumotnoma endpointlari `admission-` nomlar fazosida', () => {
    const refApi = sources['./api/reference-api.ts'] ?? '';
    const roots = [...refApi.matchAll(/'(\/[a-z-]+)'/g)]
      .map((m) => m[1])
      .filter((r): r is string => !!r);
    const dataRoots = roots.filter((r) => r.startsWith('/admission'));
    expect(dataRoots.length).toBeGreaterThanOrEqual(4);
    expect(roots).not.toContain('/countries');
    expect(roots).not.toContain('/directions');
  });
});
