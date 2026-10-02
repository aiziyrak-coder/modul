import { describe, expect, it } from 'vitest';
import { allSelected, selectedRows, toggleAll } from './row-selection';

interface Row {
  id: string;
  status: string;
}

const page1: Row[] = [
  { id: 'a', status: 'approved' },
  { id: 'b', status: 'new' },
  { id: 'c', status: 'approved' },
];

const ok = (r: Row) => r.status === 'approved';

describe('selectedRows', () => {
  it('faqat belgilangan VA mos qatorlarni qaytaradi', () => {
    expect(selectedRows(page1, ['a', 'b'], ok).map((r) => r.id)).toEqual(['a']);
  });

  it('boshqa sahifadagi id amalga OQIB O`TMAYDI', () => {
    expect(selectedRows(page1, ['z'], ok)).toEqual([]);
  });

  it('hech narsa belgilanmagan bo`lsa bo`sh', () => {
    expect(selectedRows(page1, [], ok)).toEqual([]);
  });
});

describe('toggleAll', () => {
  const pageIds = ['a', 'c'];

  it('yoqilganda mos id`larni qo`shadi, mos bo`lmagani qo`shilmaydi', () => {
    const next = toggleAll([], pageIds, true);
    expect(next.sort()).toEqual(['a', 'c']);
    expect(next).not.toContain('b');
  });

  it('takror qo`shmaydi', () => {
    expect(toggleAll(['a'], pageIds, true).sort()).toEqual(['a', 'c']);
  });

  it('o`chirilganda BOSHQA sahifadagi belgilash saqlanadi', () => {
    expect(toggleAll(['a', 'c', 'z'], pageIds, false)).toEqual(['z']);
  });
});

describe('allSelected', () => {
  it('hammasi belgilangan bo`lsa true', () => {
    expect(allSelected(['a', 'c'], ['a', 'c'])).toBe(true);
  });

  it('bittasi yetishmasa false', () => {
    expect(allSelected(['a'], ['a', 'c'])).toBe(false);
  });

  it('tanlanadigan qator YO`Q bo`lsa false (bo`sh jadvalda "hammasi" belgilanmasin)', () => {
    expect(allSelected(['a'], [])).toBe(false);
  });
});
