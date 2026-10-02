import { describe, expect, it } from 'vitest';

const sources = import.meta.glob('./pages/hindex/index.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const src = Object.values(sources)[0] ?? '';

const payloadBlock = (() => {
  const i = src.indexOf('const payload: HIndexUpsertPayload = {');
  return i === -1 ? '' : src.slice(i, src.indexOf('};', i));
})();

describe('h-indeks URL modali', () => {
  it('sahifa va payload topildi (bekorga o`tmasin)', () => {
    expect(src).toContain('useUpsertMyHIndex');
    expect(payloadBlock).toContain('scopusUrl');
  });

  it('formada ko`rsatkich maydonlari YO`Q', () => {
    expect(src).not.toContain('name="scopusHIndex"');
    expect(src).not.toContain('name="scopusCitations"');
    expect(src).not.toContain('name="scholarHIndex"');
    expect(src).not.toContain('name="scholarCitations"');
    expect(src).not.toContain('metricsOptional');
  });

  it('ikkala URL maydoni "Masalan: ..." namunasi bilan', () => {
    expect(src).toContain('hindex.scopusExample');
    expect(src).toContain('hindex.scholarExample');
  });

  it('payloadda ko`rsatkichlar YUBORILMAYDI (eski qiymat nolga tushmasin)', () => {
    expect(payloadBlock).not.toContain('scopusHIndex');
    expect(payloadBlock).not.toContain('scopusCitations');
    expect(payloadBlock).not.toContain('scholarHIndex');
    expect(payloadBlock).not.toContain('scholarCitations');
  });
});
