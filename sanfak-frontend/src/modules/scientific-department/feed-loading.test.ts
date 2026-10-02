import { describe, expect, it } from 'vitest';

const sources = import.meta.glob('./{pages,api}/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const read = (fragment: string) => {
  const entry = Object.entries(sources).find(([p]) => p.includes(fragment));
  expect(entry, `${fragment} topilmadi`).toBeDefined();
  return entry![1];
};

const FEEDS = ['/pages/posts/index.tsx', '/pages/announcements/index.tsx'];

describe('feed sahifalarida yuklanish indikatori', () => {
  it('ikkala sahifa ham `loading={isFetching}` uzatadi', () => {
    FEEDS.forEach((f) => {
      const src = read(f);
      expect(src, f).toContain('<FeedPager');
      expect(src, f).toMatch(/loading=\{isFetching\}/);
    });
  });

  it('`isFetching` hook`dan haqiqatan olinadi', () => {
    FEEDS.forEach((f) => {
      expect(read(f), f).toMatch(/const \{[^}]*isFetching[^}]*\} =/);
    });
  });

  it('manbadagi hooklar `keepPreviousData` bilan — shu sabab isFetching kerak', () => {
    expect(read('/api/scientific-post-api.ts')).toContain('keepPreviousData');
    expect(read('/api/notification-api.ts')).toContain('keepPreviousData');
  });
});
