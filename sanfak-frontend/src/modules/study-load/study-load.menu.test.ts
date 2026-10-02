import { describe, expect, it } from 'vitest';
import { buildMenuTree } from '@/app/modules/build-menu';
import manifest from './study-load.module';

const P = '/study-load/approval-inbox';
const t = (key: string) => key;

const ALL_APPROVE_KEYS = [
  'workload:approve',
  'workloadDistribution:approve',
  'syllabus:approve',
  'scienceProgram:approve',
  'workingSchedule:approve',
  'workloadSummary:approve',
  'contingentReport:approve',
];

const raw = () =>
  (manifest.menu ?? []).map((m) => ({
    path: m.path,
    titleKey: m.titleKey,
    order: m.order ?? 100,
    permission: m.permission,
    parent: m.parent,
    subGroupOrder: m.subGroup?.order ?? 100,
  }));

const hasApprovalInbox = (permissions: readonly string[]) =>
  buildMenuTree(raw(), permissions, t).some((n) => n.path === P);

describe('study-load "Tasdiqlash paneli" (approval-inbox) menu gating', () => {
  it('manifest declares the union of all 7 entities\' approve keys (not a hand-picked subset)', () => {
    const item = (manifest.menu ?? []).find((m) => m.path === P);
    expect(item?.permission).toEqual(ALL_APPROVE_KEYS);
  });

  it('kafedra_mudiri-shaped permission set (has workload:approve) sees the panel', () => {
    expect(hasApprovalInbox(['workloadDistribution:approve', 'workload:approve'])).toBe(true);
  });

  it('arm-shaped permission set (only syllabus:approve, no workload section) sees the panel', () => {
    expect(hasApprovalInbox(['syllabus:read', 'syllabus:readAll', 'syllabus:approve'])).toBe(true);
  });

  it('dekan-shaped permission set (only workingSchedule/workloadDistribution approve — the 2026-08-12 regression) sees the panel', () => {
    expect(
      hasApprovalInbox([
        'workingSchedule:read',
        'workingSchedule:readAll',
        'workingSchedule:approve',
        'workloadDistribution:read',
        'workloadDistribution:readAll',
        'workloadDistribution:approve',
      ]),
    ).toBe(true);
  });

  it('oqituvchi-shaped permission set (read/update only, no :approve anywhere) does NOT see the panel', () => {
    expect(
      hasApprovalInbox([
        'syllabus:create',
        'syllabus:read',
        'syllabus:readAll',
        'syllabus:update',
        'scienceProgram:create',
        'scienceProgram:read',
        'scienceProgram:readAll',
        'scienceProgram:update',
        'workloadDistribution:read',
        'workloadDistribution:changeStatus',
      ]),
    ).toBe(false);
  });

  it('a completely unrelated role (no study-load permissions at all) does NOT see the panel', () => {
    expect(hasApprovalInbox(['qualCourse:read', 'qualCourse:readAll'])).toBe(false);
  });

  it('an empty permission set does NOT see the panel', () => {
    expect(hasApprovalInbox([])).toBe(false);
  });
});

describe('study-load "Kafedra kontingenti" menu gating', () => {
  const DC = '/study-load/department-contingents';
  const hasDeptContingent = (permissions: readonly string[]) =>
    buildMenuTree(raw(), permissions, t).some((n) => n.path === DC);

  it('manifest menu item is gated by departmentContingent:readAll and not in the approval-inbox union', () => {
    const item = (manifest.menu ?? []).find((m) => m.path === DC);
    expect(item?.permission).toBe('departmentContingent:readAll');
    const inbox = (manifest.menu ?? []).find((m) => m.path === P);
    expect(inbox?.permission).not.toContain('departmentContingent:approve');
  });

  it('kafedra_mudiri-shaped set (CRUD) and O\'UB-shaped set (read/readAll) see the item', () => {
    expect(
      hasDeptContingent([
        'departmentContingent:create',
        'departmentContingent:read',
        'departmentContingent:readAll',
        'departmentContingent:update',
        'departmentContingent:delete',
      ]),
    ).toBe(true);
    expect(hasDeptContingent(['departmentContingent:read', 'departmentContingent:readAll'])).toBe(true);
  });

  it('T-08 contingentReport grants alone (dekan) do NOT open the department contingent', () => {
    expect(hasDeptContingent(['contingentReport:read', 'contingentReport:readAll', 'contingentReport:approve'])).toBe(false);
  });
});
