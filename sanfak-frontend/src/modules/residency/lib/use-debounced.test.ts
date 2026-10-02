import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeSearch, useDebounced, useDebouncedSearch } from './use-debounced';

describe('normalizeSearch', () => {
  it("bosh va oxirgi bo'shliqlarni olib tashlaydi", () => {
    expect(normalizeSearch('  apple  ')).toBe('apple');
  });

  it("ichkaridagi ketma-ket bo'shliqlarni bittaga siqadi", () => {
    expect(normalizeSearch('Karimov   Aziz')).toBe('Karimov Aziz');
  });

  it("faqat bo'shliqdan iborat matn bo'sh satrga aylanadi", () => {
    expect(normalizeSearch('   ')).toBe('');
  });
});

describe('useDebounced', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('birinchi qiymatni DARHOL qaytaradi', () => {
    const { result } = renderHook(() => useDebounced('apple', 300));
    expect(result.current).toBe('apple');
  });

  it('kechikish tugamaguncha eski qiymatni ushlab turadi', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounced(v, 300), {
      initialProps: { v: 'a' },
    });

    rerender({ v: 'ap' });
    rerender({ v: 'app' });
    expect(result.current).toBe('a');

    act(() => void vi.advanceTimersByTime(299));
    expect(result.current).toBe('a');

    act(() => void vi.advanceTimersByTime(1));
    expect(result.current).toBe('app');
  });

  it("tez yozishda faqat OXIRGI qiymat o'tadi (oraliqlari tashlanadi)", () => {
    const seen: string[] = [];
    const { rerender } = renderHook(
      ({ v }) => {
        seen.push(useDebounced(v, 300));
      },
      { initialProps: { v: '' } },
    );

    for (const v of ['a', 'ap', 'app', 'appl', 'apple']) {
      rerender({ v });
      act(() => void vi.advanceTimersByTime(50));
    }
    act(() => void vi.advanceTimersByTime(300));

    expect([...new Set(seen)]).toEqual(['', 'apple']);
  });
});

describe('useDebouncedSearch', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("faqat bo'shliq qo'shilsa YANGI qiymat bermaydi", () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedSearch(v, 300), {
      initialProps: { v: 'ali' },
    });
    expect(result.current).toBe('ali');

    rerender({ v: 'ali ' });
    act(() => void vi.advanceTimersByTime(300));
    expect(result.current).toBe('ali');
  });

  it("faqat bo'shliqdan iborat qidiruv bo'sh satr beradi — filtr qo'yilmaydi", () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedSearch(v, 300), {
      initialProps: { v: '' },
    });
    rerender({ v: '   ' });
    act(() => void vi.advanceTimersByTime(300));
    expect(result.current).toBe('');
  });
});
