import { describe, expect, it } from 'vitest';
import { renumberTopicCodes, TOPIC_CODE_PREFIX } from './topic-code';

describe('renumberTopicCodes — tur bo`yicha raqamlash', () => {
  it("aralash tartibdagi mavzulardan `M1, A1, M2, L1` hosil bo'ladi (ro'yxat tartibi saqlanadi)", () => {
    const out = renumberTopicCodes([
      { type: 'maruza', title: 'a' },
      { type: 'amaliy', title: 'b' },
      { type: 'maruza', title: 'c' },
      { type: 'laboratoriya', title: 'd' },
    ]);

    expect(out.map((t) => t.code)).toEqual(['M1', 'A1', 'M2', 'L1']);
    expect(out.map((t) => t.title)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('beshala tur ham o`z prefiksini oladi (S — seminar, K — klinik amaliyot)', () => {
    const out = renumberTopicCodes([
      { type: 'seminar' },
      { type: 'klinik_amaliyot' },
      { type: 'klinik_amaliyot' },
    ]);

    expect(out.map((t) => t.code)).toEqual(['S1', 'K1', 'K2']);
    expect(Object.keys(TOPIC_CODE_PREFIX)).toHaveLength(5);
  });

  it("tur o'zgarsa qayta raqamlanadi — eski `code` E'TIBORGA OLINMAYDI", () => {
    const first = renumberTopicCodes([
      { type: 'maruza', code: 'X9' },
      { type: 'maruza', code: '' },
    ]);
    expect(first.map((t) => t.code)).toEqual(['M1', 'M2']);

    const second = renumberTopicCodes(
      first.map((t, i) => (i === 1 ? { ...t, type: 'amaliy' as const } : t)),
    );
    expect(second.map((t) => t.code)).toEqual(['M1', 'A1']);
  });

  it("turi tanlanmagan qator `code: ''` oladi va hisobga kirmaydi", () => {
    const out = renumberTopicCodes([
      { type: '' },
      { type: 'maruza' },
      { type: undefined },
      { type: 'maruza' },
    ]);

    expect(out.map((t) => t.code)).toEqual(['', 'M1', '', 'M2']);
  });

  it('kirish massivi va elementlari MUTATSIYA qilinmaydi (Formik uchun yangi obyekt)', () => {
    const input = [{ type: 'maruza' as const, code: '' }];
    const out = renumberTopicCodes(input);

    expect(out).not.toBe(input);
    expect(out[0]).not.toBe(input[0]);
    expect(input[0]!.code).toBe('');
  });

  it("bo'sh ro'yxat → bo'sh ro'yxat", () => {
    expect(renumberTopicCodes([])).toEqual([]);
  });
});
