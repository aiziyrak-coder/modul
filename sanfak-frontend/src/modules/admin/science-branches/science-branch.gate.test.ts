import { describe, it, expect } from 'vitest';
import { scienceBranchConfig } from './science-branch.config';

describe("Fan tarmoqlari ma'lumotnomasi — seam kontrakti", () => {
  it("permission seksiyasi va root yo'l barqaror", () => {
    expect(scienceBranchConfig.section).toBe('scienceBranch');
    expect(scienceBranchConfig.root).toBe('/science-branches');
  });
});

describe('Fan tarmoqlari sahifasi — kirish darajasi', () => {
  it("route gate `create` — o'qish huquqi bilan URL orqali ham kirilmaydi", async () => {
    const mod = (await import('../admin.module')).default;
    const route = mod.routes?.find((r: { path?: string }) => r.path === 'science-branches');
    expect(route?.permission).toBe('scienceBranch:create');
  });

  it("boshqa lug'atlar loyihaning umumiy qoidasida qoladi (`readAll`)", async () => {
    const mod = (await import('../admin.module')).default;
    const other = mod.routes?.find((r: { path?: string }) => r.path === 'academic-levels');
    expect(other?.permission).toBe('academicLevel:readAll');
  });
});
