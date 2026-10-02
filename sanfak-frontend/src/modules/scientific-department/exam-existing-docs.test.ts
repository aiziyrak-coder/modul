import { describe, expect, it } from 'vitest';

const sources = import.meta.glob('./pages/qualification-exam/index.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const src = Object.values(sources)[0] ?? '';

describe('talabgor formasi — mavjud hujjatlar', () => {
  it('sahifa topildi (test bekorga o`tmasin)', () => {
    expect(src).toContain('APPLICANT_DOC_SLOTS');
  });

  it('mavjud hujjat `FileChip` bilan ko`rsatiladi', () => {
    expect(src).toContain("from '../../components/file-chip'");
    expect(src).toMatch(/<FileChip url=\{existingUrl\}/);
  });

  it('mavjud fayl faqat `add` BO`LMAGAN rejimda olinadi', () => {
    expect(src).toMatch(
      /const existingUrl = formMode === 'add' \? undefined : editing\?\.documents\?\.\[slot\]/,
    );
  });

  it('fayl bor bo`lsa tugma matni "almashtirish"', () => {
    expect(src).toContain('scientificDepartment.exam.replaceFile');
  });
});
