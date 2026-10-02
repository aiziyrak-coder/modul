import { describe, expect, it } from 'vitest';

const sources = import.meta.glob('./pages/qualification-exam/index.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const src = Object.values(sources)[0] ?? '';

const code = src
  .split('\n')
  .filter((l) => {
    const s = l.trim();
    return !s.startsWith('//') && !s.startsWith('*') && !s.startsWith('/*') && !s.startsWith('{/*');
  })
  .join('\n');

describe('qaror modallari bir xil', () => {
  it('sahifa topildi (bekorga o`tmasin)', () => {
    expect(src).toContain('rejectTarget');
    expect(src).toContain('approveTarget');
  });

  it('tasdiqlash imperativ `modal.confirm` EMAS', () => {
    expect(code).toContain('approveApplicant');
    expect(code).not.toContain('modal.confirm');
  });

  it('ikkalasi ham `ApplicantCard` ishlatadi', () => {
    expect(src).toMatch(/<ApplicantCard[\s\S]*?name=\{approveTarget\.name\}/);
    expect(src).toMatch(/<ApplicantCard name=\{rejectTarget\.name\}/);
  });

  it('ogohlantirish ikkalasida ham KONTENTDAN KEYIN', () => {
    const warnings = src.match(/<DecisionWarning \/>/g) ?? [];
    expect(warnings.length).toBe(2);

    const textArea = src.indexOf('placeholder={t(\'scientificDepartment.rejectReasonPlaceholder\')}');
    const lastWarning = src.lastIndexOf('<DecisionWarning />');
    expect(textArea).toBeGreaterThan(0);
    expect(lastWarning).toBeGreaterThan(textArea);
  });
});
