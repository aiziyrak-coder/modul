import { describe, expect, it } from 'vitest';
import { buildMenuTree } from '@/app/modules/build-menu';
import manifest from './teacher.module';

const P = '/teacher';

const raw = () =>
  (manifest.menu ?? []).map((m) => ({
    path: m.path,
    titleKey: m.titleKey,
    order: m.order ?? 100,
    permission: m.permission,
    parent: m.parent,
    subGroupOrder: m.subGroup?.order ?? 100,
  }));

const t = (key: string) => key;

const tree = (permissions: readonly string[]) => buildMenuTree(raw(), permissions, t);

const groupPaths = () =>
  new Set((manifest.menu ?? []).flatMap((m) => (m.parent ? [m.parent] : [])));

const routePaths = () => {
  const base = manifest.basePath ?? P;
  return new Set(
    (manifest.routes ?? []).map((r) =>
      r.path ? `${base.replace(/\/$/, '')}/${String(r.path).replace(/^\//, '')}` : base,
    ),
  );
};

const TEACHER = [
  'personalWorkPlan:create',
  'personalWorkPlan:read',
  'personalWorkPlan:readAll',
  'personalWorkPlan:update',
  'personalWorkPlan:delete',
  'personalWorkPlan:approve',
  'teacher:read',
  'teacher:readAll',
];

describe('teacher sidebar menyu', () => {
  it('guruh yo`li ROUTE bo`lmasligi shart (aks holda sahifa ochilmaydi)', () => {
    const routes = routePaths();
    const clashes = [...groupPaths()].filter((g) => routes.has(g));
    expect(clashes, `guruh yo'li route bilan to'qnashdi: ${clashes.join(', ')}`).toEqual([]);
  });

  it('har bir `parent` mavjud menyu bandiga ishora qiladi', () => {
    const all = new Set((manifest.menu ?? []).map((m) => m.path));
    const orphans = (manifest.menu ?? [])
      .filter((m) => m.parent && !all.has(m.parent))
      .map((m) => m.path);
    expect(orphans).toEqual([]);
  });

  it('yo`llar takrorlanmaydi (duplicate path menyu tugunini o`g`irlaydi)', () => {
    const list = (manifest.menu ?? []).map((m) => m.path);
    expect(list).toHaveLength(new Set(list).size);
  });

  it('o`qituvchida "Shaxsiy ish reja" BOSILADIGAN band (bolasi yo`q)', () => {
    const nodes = tree(TEACHER);
    const flat: { path: string; children: unknown[] }[] = [];
    const walk = (ns: ReturnType<typeof tree>) => {
      for (const n of ns) {
        flat.push({ path: n.path, children: n.children });
        walk(n.children);
      }
    };
    walk(nodes);

    const plan = flat.find((n) => n.path === `${P}/work-plans`);
    expect(plan, 'menyuda "Shaxsiy ish reja" umuman yo`q').toBeDefined();
    expect(
      plan?.children.length,
      'bolasi bor ⇒ sidebar uni dropdown qiladi va sahifa ochilmaydi',
    ).toBe(0);
  });

  it('hech qanday huquqsiz menyu bo`sh', () => {
    expect(tree([])).toEqual([]);
  });
});
