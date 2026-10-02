import { describe, expect, it } from 'vitest';

const sources = import.meta.glob('./{pages,components}/**/index.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const detailEntries = Object.entries(sources).filter(
  ([path]) =>
    /\/pages\/[a-z-]+-detail\//.test(path) || path.includes('/plan-detail-view/'),
);

const DELEGATES = ['annual-report-detail', 'work-plan-detail'];

const owning = detailEntries.filter(
  ([path]) => !DELEGATES.some((d) => path.includes(d)),
);

describe('detal sahifalarida "Orqaga"', () => {
  it('barcha detal sahifalari topildi (bekorga o`tmasin)', () => {
    expect(owning.length).toBeGreaterThanOrEqual(9);
  });

  it('har biri `useBackTo` ishlatadi', () => {
    const missing = owning
      .filter(([, src]) => !src.includes('useBackTo'))
      .map(([path]) => path)
      .sort();

    expect(missing).toEqual([]);
  });

  it('qat`iy `navigate(' + "'/scientific-department/...')` qolmagan", () => {
    const offenders = owning
      .filter(([, src]) => /onClick=\{\(\) => navigate\('\/scientific-department/.test(src))
      .map(([path]) => path)
      .sort();

    expect(offenders).toEqual([]);
  });
});
