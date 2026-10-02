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

describe('talabgor formasida "Izlanuvchi turi" yo`q', () => {
  it('forma maydoni qaytarilmagan', () => {
    const src = read('/pages/qualification-exam/index.tsx');

    expect(src).toContain('name="specialization"');
    expect(src).not.toContain('name="researcherType"');
  });

  it('yozish (submit) payloadida yo`q', () => {
    const src = read('/pages/qualification-exam/index.tsx');
    expect(src).not.toMatch(/researcherType:\s*values\./);
  });

  it('multipart so`roviga qo`shilmaydi', () => {
    const src = read('/api/qualifying-applicant-api.ts');

    expect(src).toContain('fileSlots');
    expect(src).not.toMatch(/researcherType:\s*v\.researcherType/);
  });

  it('detal sahifasida ham qator YO`Q (xom kalit chiqishi mumkin emas)', () => {
    const src = read('/pages/qualification-exam-detail/index.tsx');

    expect(src).toContain('exam.colSpecialty');
    expect(src).not.toContain('researcherType');
    expect(src).not.toContain('exam.researcher.');
  });
});
