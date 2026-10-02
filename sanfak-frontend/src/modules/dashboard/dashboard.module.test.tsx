import { describe, expect, it } from 'vitest';
import { buildMenuTree } from '@/app/modules/build-menu';
import manifest from './dashboard.module';

const t = (key: string) => key;

const rawMenu = () =>
  (manifest.menu ?? []).map((item) => ({
    path: item.path,
    titleKey: item.titleKey,
    order: item.order ?? 100,
    permission: item.permission,
  }));

describe('dashboard manifest — gate', () => {
  it("`dashboard:read` YO'Q foydalanuvchida menyu bandi chiqmaydi", () => {
    const granted = ['practice:readAll', 'task:readAll', 'workload:readAll'];
    expect(buildMenuTree(rawMenu(), granted, t)).toEqual([]);
  });

  it('`dashboard:read` BOR foydalanuvchida menyu bandi chiqadi', () => {
    const tree = buildMenuTree(rawMenu(), ['dashboard:read'], t);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.path).toBe('/bosh-sahifa');
  });

  it("route `dashboard:read` bilan gate qilingan (to'g'ridan-to'g'ri URL bloklanadi)", () => {
    expect(manifest.routes).toHaveLength(1);
    expect(manifest.routes[0]?.index).toBe(true);
    expect(manifest.routes[0]?.permission).toBe('dashboard:read');
  });

  it("kalit manifestda E'LON qilingan (backend katalogi bilan reconciliation uchun)", () => {
    expect(manifest.permissions?.map((p) => p.key)).toEqual(['dashboard:read']);
  });
});
