import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT_CATEGORIES } from './model/achievement-config';

const sources = import.meta.glob('./pages/**/index.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const read = (name: string) => {
  const entry = Object.entries(sources).find(([p]) => p.includes(`/pages/${name}/`));
  expect(entry, `${name} sahifasi topilmadi`).toBeDefined();
  return entry![1];
};

const HAS_COUNT = /\(\$?\{(count|total)\}\)/;

describe('yutuq tablarida yozuv soni', () => {
  it('`my-achievements` tab yorlig`ida son bor', () => {
    expect(read('my-achievements')).toMatch(HAS_COUNT);
  });

  it('`reports` tab yorlig`ida ham son bor (ikkala sahifa bir xil)', () => {
    expect(read('reports')).toMatch(HAS_COUNT);
  });

  it('`my-achievements` son so`rovlari sahifadan bog`liq EMAS', () => {
    const src = read('my-achievements');

    const light = src.match(/usePaginate\(1, 1, \{\}\)/g) ?? [];
    expect(light.length).toBe(ACHIEVEMENT_CATEGORIES.length);

    const paged = src.match(/usePaginate\(page, pageSize/g) ?? [];
    expect(paged.length).toBe(1);
  });
});
