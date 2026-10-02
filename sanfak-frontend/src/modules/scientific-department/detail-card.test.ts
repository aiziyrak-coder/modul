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

describe('detal sahifalari kartochka ichida', () => {
  it('barcha detal sahifalari topildi (bekorga o`tmasin)', () => {
    expect(detailEntries.length).toBeGreaterThanOrEqual(10);
  });

  it('har bir detal sahifada `Card` bor', () => {
    const missing = detailEntries
      .filter(([path]) => !DELEGATES.some((d) => path.includes(d)))
      .filter(([, src]) => !src.includes('<Card'))
      .map(([path]) => path)
      .sort();

    expect(missing).toEqual([]);
  });

  it('o`ram sahifalar haqiqatan `PlanDetailView`ga topshiradi', () => {
    const delegates = detailEntries.filter(([path]) =>
      DELEGATES.some((d) => path.includes(d)),
    );

    expect(delegates.length).toBe(DELEGATES.length);
    delegates.forEach(([path, src]) => {
      expect(src, path).toContain('PlanDetailView');
    });
  });
});
