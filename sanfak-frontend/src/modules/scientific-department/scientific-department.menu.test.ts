import { describe, expect, it } from 'vitest';
import { buildMenuTree } from '@/app/modules/build-menu';
import manifest from './scientific-department.module';

const P = '/scientific-department';

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

const ALL = [
  ...new Set(
    (manifest.menu ?? []).flatMap((m) =>
      !m.permission ? [] : Array.isArray(m.permission) ? m.permission : [m.permission],
    ),
  ),
];

const TEACHER = [
  'scientificPortal:read',
  'article:create',
  'article:readAll',
  'thesis:readAll',
  'methodicalRecommendation:readAll',
  'monograph:readAll',
  'hIndex:readAll',
  'scientificDegree:create',
  'scientificTitle:create',
  'patent:create',
  'copyright:create',
  'defense:create',
  'defense:read',
  'defense:readAll',
  'scientificDegree:read',
  'scientificDegree:readAll',
  'scientificTitle:read',
  'scientificTitle:readAll',
  'patent:read',
  'copyright:read',
  'patent:readAll',
  'copyright:readAll',
  'qualifyingApplicant:readAll',
  'scientificPost:readAll',
  'startup:read',
];

const tree = (permissions: readonly string[]) => buildMenuTree(raw(), permissions, t);
const paths = (nodes: ReturnType<typeof tree>) => nodes.map((n) => n.path);
const childrenOf = (nodes: ReturnType<typeof tree>, path: string) =>
  nodes.find((n) => n.path === path)?.children.map((c) => c.path) ?? [];

const groupPaths = () =>
  new Set((manifest.menu ?? []).flatMap((m) => (m.parent ? [m.parent] : [])));

describe('scientific-department sidebar menu', () => {
  it('manifest yaxlit: har bir `parent` mavjud element yo`liga ishora qiladi', () => {
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

  it('guruh route`siz va permission`i bolalaridan biriniki (reference sahifa)', () => {
    for (const g of groupPaths()) {
      const node = (manifest.menu ?? []).find((m) => m.path === g);
      expect(node, `guruh e'lon qilinmagan: ${g}`).toBeDefined();

      const isRoute = (manifest.routes ?? []).some((r) => `${P}/${r.path}` === g);
      expect(isRoute, `guruh yo'li route bilan to'qnashdi: ${g}`).toBe(false);

      const childPerms = (manifest.menu ?? [])
        .filter((m) => m.parent === g)
        .map((m) => m.permission);
      expect(childPerms, `guruh permission'i bolalarinikiga mos emas: ${g}`).toContain(
        node?.permission,
      );
    }
  });

  it('to`liq huquqda example UI strukturasi quriladi', () => {
    const nodes = tree(ALL);
    expect(paths(nodes)).toEqual([
      `${P}/dashboard`,
      `${P}/statistics`,
      `${P}/potential-group`,
      `${P}/achievements-group`,
      `${P}/articles-group`,
      `${P}/theses-group`,
      `${P}/certificates`,
      `${P}/patents`,
      `${P}/methodical-group`,
      `${P}/monographs-group`,
      `${P}/startups-group`,
      `${P}/conferences`,
      `${P}/hindex`,
      `${P}/work-plans`,
      `${P}/annual-reports`,
      `${P}/industry-orders`,
      `${P}/exam-group`,
      `${P}/posts`,
    ]);

    expect(childrenOf(nodes, `${P}/potential-group`)).toEqual([
      `${P}/scientific-degrees`,
      `${P}/scientific-titles`,
      `${P}/defense`,
    ]);
    expect(childrenOf(nodes, `${P}/achievements-group`)).toEqual([
      `${P}/my-degrees`,
      `${P}/my-titles`,
      `${P}/my-defense`,
      `${P}/my-certificates`,
      `${P}/my-patents`,
    ]);
    expect(childrenOf(nodes, `${P}/articles-group`)).toEqual([`${P}/articles`, `${P}/journals`]);
    expect(childrenOf(nodes, `${P}/theses-group`)).toEqual([`${P}/theses`, `${P}/thesis-categories`]);
    expect(childrenOf(nodes, `${P}/methodical-group`)).toEqual([
      `${P}/methodical`,
      `${P}/methodical-templates`,
      `${P}/methodical-specialties`,
    ]);
    expect(childrenOf(nodes, `${P}/monographs-group`)).toEqual([
      `${P}/monographs`,
      `${P}/monograph-templates`,
    ]);
    expect(childrenOf(nodes, `${P}/startups-group`)).toEqual([
      `${P}/startups`,
      `${P}/startup-types`,
    ]);
    expect(childrenOf(nodes, `${P}/exam-group`)).toEqual([
      `${P}/qualification-exam`,
      `${P}/exam-specialties`,
    ]);
  });

  it('o`qituvchida yagona "Ilmiy yutuqlarim" guruhi (4 bola) bo`ladi', () => {
    const nodes = tree(TEACHER);

    expect(paths(nodes)).toEqual([
      `${P}/dashboard`,
      `${P}/achievements-group`,
      `${P}/articles`,
      `${P}/theses`,
      `${P}/methodical`,
      `${P}/monographs`,
      `${P}/startups`,
      `${P}/hindex`,
      `${P}/qualification-exam`,
      `${P}/posts`,
    ]);

    const withChildren = nodes.filter((n) => n.children.length > 0).map((n) => n.path);
    expect(withChildren).toEqual([`${P}/achievements-group`]);
    expect(childrenOf(nodes, `${P}/achievements-group`)).toEqual([
      `${P}/my-degrees`,
      `${P}/my-titles`,
      `${P}/my-defense`,
      `${P}/my-certificates`,
      `${P}/my-patents`,
    ]);
    expect(paths(nodes)).not.toContain(`${P}/certificates`);
    expect(paths(nodes)).not.toContain(`${P}/patents`);
    expect(paths(nodes)).not.toContain(`${P}/potential-group`);

    const groups = groupPaths();
    expect(
      paths(nodes).filter((x) => groups.has(x) && x !== `${P}/achievements-group`),
    ).toEqual([]);
  });

  it('bolasi qolmagan guruh butunlay yo`qoladi (bo`sh guruh → 404 bo`lmasin)', () => {
    const nodes = tree(['conference:readAll']);
    expect(paths(nodes)).toEqual([`${P}/conferences`]);
  });

  it('hech qanday huquqsiz menyu bo`sh', () => {
    expect(tree([])).toEqual([]);
  });
});
