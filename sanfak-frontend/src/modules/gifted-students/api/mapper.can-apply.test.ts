import { describe, it, expect } from 'vitest';
import { mapScholarship } from './mapper';

const base = (over: Record<string, unknown> = {}) =>
  mapScholarship({ _id: 'sch1', name: 'Beruniy', type: 'nomdor', ...over });

describe('mapScholarship — canApply', () => {
  it('ruxsat: `true` + sabab `null`', () => {
    const s = base({ canApply: true, canApplyReason: null });
    expect(s.canApply).toBe(true);
    expect(s.canApplyReason).toBeNull();
  });

  it('rad: sabab SERVER matni bilan o‘tadi', () => {
    const s = base({ canApply: false, canApplyReason: 'Ariza muddati tugagan (2026-09-03)' });
    expect(s.canApply).toBe(false);
    expect(s.canApplyReason).toBe('Ariza muddati tugagan (2026-09-03)');
  });

  it('🔴 maydon KELMASA — `undefined`, `false` EMAS', () => {
    const s = base();
    expect(s.canApply).toBeUndefined();
    expect(s).not.toHaveProperty('canApplyReason');
  });

  it('`canApply: false` sababsiz kelsa ham `null` bo‘ladi (undefined emas)', () => {
    const s = base({ canApply: false });
    expect(s.canApply).toBe(false);
    expect(s.canApplyReason).toBeNull();
  });

  it('🔴 mijozda QAYTA HISOBLANMAYDI — `minScore` ga qaramaydi', () => {
    const s = base({ minScore: 9999, canApply: true, canApplyReason: null });
    expect(s.canApply).toBe(true);
    expect(s.minScore).toBe(9999);
  });

  it('boshqa maydonlar TEGILMAYDI', () => {
    const s = base({ canApply: false, canApplyReason: 'x', active: false, minScore: 60 });
    expect(s.name).toBe('Beruniy');
    expect(s.active).toBe(false);
    expect(s.minScore).toBe(60);
  });
});
