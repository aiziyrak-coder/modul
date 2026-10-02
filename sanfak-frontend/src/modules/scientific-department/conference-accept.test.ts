import { describe, expect, it } from 'vitest';

const sources = import.meta.glob('./**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const ACCEPT_LABEL = "conferences.accept'";

describe('konferensiyani qabul qilish — holat tekshiruvi', () => {
  it('amalni render qiluvchi har bir sahifa `acceptedByMe` ga tayanadi', () => {
    const pages = Object.entries(sources).filter(
      ([path, src]) => !path.endsWith('.module.tsx') && src.includes(ACCEPT_LABEL),
    );

    const offenders = pages
      .filter(([, src]) => !src.includes('acceptedByMe'))
      .map(([path]) => path)
      .sort();

    expect(Object.keys(sources).length).toBeGreaterThan(20);
    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect(offenders).toEqual([]);
  });
});
