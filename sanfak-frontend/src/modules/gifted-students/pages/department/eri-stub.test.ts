import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const gifted = readFileSync(join(here, 'Review.tsx'), 'utf8');
const residency = readFileSync(
  join(here, '../../../residency/components/plan/PlanReviewView.tsx'),
  'utf8',
);

const NOTE = "ERI imzolash keyingi fazada qo&apos;shiladi";

describe('D-61 — 4.11 ERI stub', () => {
  it('kontrol QULFLANGAN', () => {
    const block = gifted.slice(gifted.indexOf('<Label>ERI kaliti</Label>'));
    expect(block.slice(0, 400)).toContain('disabled');
  });

  it('sababi ekranda aytiladi', () => {
    expect(gifted).toContain(NOTE);
  });

  it("🔴 soxta kalit ro'yxati qaytib kelmagan", () => {
    expect(gifted).not.toContain('Karimova N.R.');
    expect(gifted).not.toContain('Rahimov B.T.');
  });
});

describe('D-32 — 4.5 ERI stub', () => {
  it('kontrol QULFLANGAN', () => {
    const block = residency.slice(residency.indexOf('<Label>ERI kaliti</Label>'));
    expect(block.slice(0, 400)).toContain('disabled');
  });

  it('sababi ekranda aytiladi', () => {
    expect(residency).toContain(NOTE);
  });

  it('🔴 «imzo» DA\'VOSI olib tashlangan', () => {
    expect(residency).not.toContain('title="ERI bilan tasdiqlash"');
    expect(residency).not.toContain('<MdCheck /> Imzolash');
  });
});
