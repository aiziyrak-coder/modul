import { describe, expect, it } from 'vitest';
import { canCreateContingent, isInstituteViewer } from './scope';

describe('department-contingent scope — UI ko\'rinishlari', () => {
  it("«Yaratish»: create huquqi bor kafedra roli — ko'rinadi", () => {
    expect(canCreateContingent(true, false)).toBe(true);
  });

  it("«Yaratish»: super admin ('*') — ko'rinmaydi (backend kafedrasiz scope'ga 403, F-13)", () => {
    expect(canCreateContingent(true, true)).toBe(false);
  });

  it("«Yaratish»: create huquqi yo'q — ko'rinmaydi", () => {
    expect(canCreateContingent(false, false)).toBe(false);
  });

  it("yig'ma: kafedra mudiri ko'rmaydi, super admin va institut rollari ko'radi", () => {
    expect(isInstituteViewer('kafedra_mudiri', false)).toBe(false);
    expect(isInstituteViewer('oquv_uslubiy_boshqarma', false)).toBe(true);
    expect(isInstituteViewer(undefined, true)).toBe(true);
  });
});
