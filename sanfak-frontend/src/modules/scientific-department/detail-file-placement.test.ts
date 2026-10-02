import { describe, expect, it } from 'vitest';

const sources = import.meta.glob('./**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const detailEntries = Object.entries(sources).filter(
  ([path]) =>
    !path.includes('.test.') &&
    (/\/pages\/[a-z-]+-detail\//.test(path) || path.includes('/plan-detail-view/')),
);

const HEADER_START = /<Flex align="center"[^>]*marginBottom: 16 \}\}>/;

function headerBlock(src: string): string | null {
  const m = HEADER_START.exec(src);
  if (!m) return null;
  const from = m.index;
  const end = src.indexOf('</Flex>', from);
  return end === -1 ? null : src.slice(from, end);
}

const FILE_MARKERS = ['FilePdfOutlined', 'window.open', 'fileUrl', 'FileChip', 'fileChips'];

const stripComments = (block: string) =>
  block
    .split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('{/*'))
    .join('\n');

describe('detal sahifalarda fayl joylashuvi', () => {
  it('header blokida fayl ochuvchi element YO`Q', () => {
    const offenders = detailEntries
      .map(([path, src]) => [path, headerBlock(src)] as const)
      .filter(([, block]) => block !== null)
      .filter(([, block]) => {
        const clean = stripComments(block as string);
        return FILE_MARKERS.some((mk) => clean.includes(mk));
      })
      .map(([path]) => path)
      .sort();

    expect(detailEntries.length).toBeGreaterThanOrEqual(10);
    expect(detailEntries.filter(([, src]) => headerBlock(src) !== null).length).toBeGreaterThanOrEqual(8);

    expect(offenders).toEqual([]);
  });

  it('bitta faylli detal sahifalar `FileChip`ni Descriptions ichida ko`rsatadi', () => {
    const users = detailEntries.filter(([, src]) => src.includes('<FileChip'));
    expect(users.length).toBeGreaterThanOrEqual(4);

    const misplaced = users
      .filter(([, src]) => src.indexOf('<FileChip') > src.lastIndexOf('</Descriptions>'))
      .map(([path]) => path)
      .sort();

    expect(misplaced).toEqual([]);
  });

  it('ko`p slotli sahifalarda `fileChips` grid `</Descriptions>` dan KEYIN', () => {
    const users = detailEntries.filter(([, src]) => src.includes('{fileChips}'));
    expect(users.length).toBeGreaterThanOrEqual(3);

    const misplaced = users
      .filter(([, src]) => src.indexOf('{fileChips}') < src.indexOf('</Descriptions>'))
      .map(([path]) => path)
      .sort();

    expect(misplaced).toEqual([]);
  });
});
