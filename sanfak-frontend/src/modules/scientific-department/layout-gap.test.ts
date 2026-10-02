import { describe, expect, it } from 'vitest';

const sources = import.meta.glob('./**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const GAP = "<div aria-hidden style={{ flexShrink: 0, height: 'var(--space-6)' }} />";

const stripComments = (src: string) =>
  src
    .split('\n')
    .filter((l) => {
      const s = l.trim();
      return !s.startsWith('//') && !s.startsWith('*') && !s.startsWith('/*') && !s.startsWith('{/*');
    })
    .join('\n');

const pageEntries = Object.entries(sources)
  .filter(
    ([path]) =>
      !path.includes('/table-gap/') && !path.includes('/feed-pager/') && !path.includes('.test.'),
  )
  .map(([path, src]) => ({ path, raw: src, code: stripComments(src) }));

const hasTable = (e: (typeof pageEntries)[number]) => e.code.includes('DataTable');
const hasFeedPager = (e: (typeof pageEntries)[number]) => e.code.includes('FeedPager');
const hasGap = (e: (typeof pageEntries)[number]) => e.code.includes(GAP);

describe('sahifa oxiridagi bo`shliq', () => {
  it('bekorga o`tmasin — fayllar va uchala mexanizm ham topilgan', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(20);
    expect(pageEntries.filter(hasTable).length).toBeGreaterThan(5);
    expect(pageEntries.filter(hasFeedPager).length).toBe(2);
    expect(pageEntries.filter(hasGap).length).toBeGreaterThanOrEqual(10);
  });

  it('mixlangan bar bo`lgan sahifada spacer YO`Q', () => {
    const offenders = pageEntries
      .filter((e) => (hasTable(e) || hasFeedPager(e)) && hasGap(e))
      .map((e) => e.path)
      .sort();

    expect(offenders).toEqual([]);
  });

  it('jadval sahifalari `TableGap` orqali bo`shliq oladi', () => {
    const missing = pageEntries
      .filter((e) => hasTable(e) && !e.code.includes('TableGap'))
      .map((e) => e.path)
      .filter((p) => !p.includes('conference-detail'))
      .sort();

    expect(missing).toEqual([]);
  });

  it('bir sahifada IKKI xil mexanizm bo`lmasin', () => {
    const mixed = pageEntries
      .filter((e) => hasTable(e) && hasFeedPager(e))
      .map((e) => e.path)
      .sort();

    expect(mixed).toEqual([]);
  });
});
