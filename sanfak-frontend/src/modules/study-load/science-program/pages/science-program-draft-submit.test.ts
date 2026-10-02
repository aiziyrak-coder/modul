import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = readFileSync(join(__dirname, 'science-program-list-page.tsx'), 'utf8');

const draftColumnsBody = (src: string): string => {
  const start = src.indexOf('function useDraftColumns');
  if (start === -1) return '';
  const end = src.indexOf('interface IApprovalBodyProps', start);
  return end === -1 ? src.slice(start) : src.slice(start, end);
};

const BODY = draftColumnsBody(SRC);

describe('science-program — Qoralama tabida yuborish amali', () => {
  it('useDraftColumns tanasi topildi (skaner mo`ljalni yo`qotmadi)', () => {
    expect(BODY.length).toBeGreaterThan(0);
  });

  it('useDraftColumns `onApprove` parametrini qabul qiladi', () => {
    expect(BODY).toMatch(/onApprove:\s*\(item:\s*ScienceProgram\)\s*=>\s*void/);
  });

  it('Qoralama qatorida yuborish tugmasi bor va `onApprove` chaqiradi', () => {
    expect(BODY).toMatch(/onClick=\{\(\)\s*=>\s*onApprove\(item\)\}/);
    expect(BODY).toMatch(/CheckOutlined/);
  });

  it('yuborish tugmasi permission bilan yopilgan (UI gating saqlanadi)', () => {
    expect(BODY).toMatch(/<Can perform="scienceProgram:update">/);
  });

  it('`onApprove` useMemo bog`liqliklarida bor (stale closure bo`lmasin)', () => {
    expect(BODY).toMatch(/\[t,\s*onEdit,\s*onDelete,\s*onApprove\]/);
  });

  it('chaqiruv joyida `handleApprove` uzatilgan — faol ustunlar bilan BIR XIL amal', () => {
    expect(SRC).toMatch(
      /useDraftColumns\(\s*t,\s*handleEdit,\s*handleDelete,\s*handleApprove\s*\)/,
    );
  });

  it('Tahrirlash va O`chirish saqlanib qoldi (regressiya yo`q)', () => {
    expect(BODY).toMatch(/onClick=\{\(\)\s*=>\s*onEdit\(item\)\}/);
    expect(BODY).toMatch(/onClick=\{\(\)\s*=>\s*onDelete\(item\)\}/);
  });

  it('skaner haqiqatan ishlaydi (o`z-o`zini tekshirish)', () => {
    const buzilgan = BODY.replace(/onApprove\(item\)/g, 'NOOP(item)');
    expect(buzilgan).not.toMatch(/onClick=\{\(\)\s*=>\s*onApprove\(item\)\}/);
    expect(draftColumnsBody('// boshqa fayl')).toBe('');
  });
});
