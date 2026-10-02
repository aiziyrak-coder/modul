import { describe, expect, it } from 'vitest';
import manifest from '../study-load.module';
import { INDEX_CANDIDATES, INDEX_FALLBACK, pickIndexTarget } from './index-target';

const canOf = (granted: string[]) => {
  const can = ((p: string) => granted.includes(p)) as ((p: string) => boolean) & {
    any: (perms: string[]) => boolean;
  };
  can.any = (perms) => perms.some((p) => granted.includes(p));
  return can;
};

describe('study-load index redirect — vakolatga qarab (2026-09-14)', () => {
  it('nomzodlar manifest MENYUSI bilan bir xil tartibda va bir xil kalitlar bilan', () => {
    const menu = (manifest.menu ?? []).map((m) => ({ path: m.path, permission: m.permission }));
    expect(INDEX_CANDIDATES.map((c) => c.path)).toEqual(menu.map((m) => m.path));
    for (const c of INDEX_CANDIDATES) {
      const m = menu.find((x) => x.path === c.path);
      expect(m?.permission, c.path).toEqual(c.permission);
    }
  });

  it("statistics:read bor → «O'quv statistikasi» (O'UB, rektor)", () => {
    expect(pickIndexTarget(canOf(['statistics:read', 'workload:approve']))).toBe('/study-load/statistics');
  });

  it('tasdiqlovchi (statistika yo`q) → «Tasdiqlash paneli» (mudir, dekan, reja-moliya)', () => {
    expect(pickIndexTarget(canOf(['workingSchedule:approve', 'workingSchedule:readAll']))).toBe(
      '/study-load/approval-inbox',
    );
  });

  it("o'qituvchi → birinchi ochiq sahifa (fan dasturi)", () => {
    expect(
      pickIndexTarget(canOf(['scienceProgram:readAll', 'syllabus:readAll', 'workloadDistribution:changeStatus'])),
    ).toBe('/study-load/science-programs');
  });

  it("hech narsa yo'q → zaxira (tasdiqlash paneli, 403 emas)", () => {
    expect(pickIndexTarget(canOf([]))).toBe(INDEX_FALLBACK);
  });
});
