import { describe, expect, it } from 'vitest';
import { isContentEditable } from './content-lock';

describe('isContentEditable', () => {
  it('draft va rejected — tahrirlash OCHIQ', () => {
    expect(isContentEditable('draft')).toBe(true);
    expect(isContentEditable('rejected')).toBe(true);
  });

  it('in_review va approved — QULFLANGAN', () => {
    expect(isContentEditable('in_review')).toBe(false);
    expect(isContentEditable('approved')).toBe(false);
  });

  it('status yo`q/bo`sh bo`lsa — qulflangan (xavfsiz default)', () => {
    expect(isContentEditable(undefined)).toBe(false);
    expect(isContentEditable(null)).toBe(false);
    expect(isContentEditable('')).toBe(false);
  });

  it('noma`lum status — ochiq (qulf ro`yxati aniq, allow-list emas)', () => {
    expect(isContentEditable('new')).toBe(true);
  });
});
