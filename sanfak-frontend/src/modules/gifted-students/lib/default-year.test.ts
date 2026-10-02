import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_ACADEMIC_YEAR } from './academic-years';
import { newestYearWithData, useYearFilter } from './default-year';

describe('newestYearWithData', () => {
  it("eng yangi yilni beradi", () => {
    expect(newestYearWithData(['2023/2024', '2025/2026', '2024/2025'])).toBe('2025/2026');
  });

  it("bo'sh qiymatlar hisobga olinmaydi", () => {
    expect(newestYearWithData(['2025/2026', '', null, undefined])).toBe('2025/2026');
  });

  it("ma'lumot bo'lmasa bo'sh satr", () => {
    expect(newestYearWithData([])).toBe('');
    expect(newestYearWithData([null, undefined, ''])).toBe('');
  });
});

describe('useYearFilter', () => {
  it("🔴 MA'LUMOTSIZ yil bilan ochilgan filtr ma'lumoti bor eng yangi yilga suriladi", () => {
    const { result } = renderHook(() =>
      useYearFilter(['2020/2021', '2019/2020'], DEFAULT_ACADEMIC_YEAR),
    );

    expect(result.current[0]).toBe('2020/2021');
    expect(result.current[0]).not.toBe(DEFAULT_ACADEMIC_YEAR);
  });

  it("ma'lumot KEYINROQ kelsa ham suriladi (so'rov hali yuklanmagan)", () => {
    const { result, rerender } = renderHook(
      ({ years }: { years: string[] }) => useYearFilter(years),
      { initialProps: { years: [] as string[] } },
    );

    expect(result.current[0]).toBe('all');

    rerender({ years: ['2024/2025', '2025/2026'] });
    expect(result.current[0]).toBe('2025/2026');
  });

  it("surish BIR MARTALIK — keyingi ma'lumot tanlovni bosib ketmaydi", () => {
    const { result, rerender } = renderHook(
      ({ years }: { years: string[] }) => useYearFilter(years),
      { initialProps: { years: ['2024/2025'] } },
    );
    expect(result.current[0]).toBe('2024/2025');

    act(() => result.current[1]('all'));
    expect(result.current[0]).toBe('all');

    rerender({ years: ['2024/2025', '2025/2026'] });
    expect(result.current[0]).toBe('all');
  });

  it("ma'lumot kelgunicha qilingan QO'LDA tanlov ham saqlanadi", () => {
    const { result, rerender } = renderHook(
      ({ years }: { years: string[] }) => useYearFilter(years),
      { initialProps: { years: [] as string[] } },
    );

    act(() => result.current[1]('2019/2020'));
    rerender({ years: ['2025/2026'] });

    expect(result.current[0]).toBe('2019/2020');
  });

  it("ma'lumot umuman bo'lmasa neytral qiymat qoladi", () => {
    const { result } = renderHook(() => useYearFilter([]));
    expect(result.current[0]).toBe('all');
  });

  it("URL ga tushadigan yil uchun neytral qiymat `all` EMAS", () => {
    const { result } = renderHook(() => useYearFilter([], DEFAULT_ACADEMIC_YEAR));
    expect(result.current[0]).toBe(DEFAULT_ACADEMIC_YEAR);
  });
});
