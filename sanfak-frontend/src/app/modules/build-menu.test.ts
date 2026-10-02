import { describe, it, expect } from 'vitest';
import { buildMenuTree } from './build-menu';

const t = (key: string) => key;
const ALL = ['*'] as const;

describe('buildMenuTree — normal behaviour', () => {
  it('builds a nested parent → child tree', () => {
    const tree = buildMenuTree(
      [
        { path: '/study-load', titleKey: 'Group', order: 1 },
        { path: '/study-load/a', titleKey: 'A', order: 2, parent: '/study-load' },
        { path: '/study-load/b', titleKey: 'B', order: 3, parent: '/study-load' },
      ],
      ALL,
      t,
    );
    expect(tree).toHaveLength(1);
    expect(tree[0]?.path).toBe('/study-load');
    expect(tree[0]?.children.map((c) => c.path)).toEqual([
      '/study-load/a',
      '/study-load/b',
    ]);
  });

  it('keeps top-level items (no parent) as roots, sorted by order', () => {
    const tree = buildMenuTree(
      [
        { path: '/b', titleKey: 'B', order: 20 },
        { path: '/a', titleKey: 'A', order: 10 },
      ],
      ALL,
      t,
    );
    expect(tree.map((n) => n.path)).toEqual(['/a', '/b']);
  });

  it('filters out entries the user lacks permission for', () => {
    const tree = buildMenuTree(
      [{ path: '/secret', titleKey: 'S', order: 1, permission: 'admin:read' }],
      [],
      t,
    );
    expect(tree).toHaveLength(0);
  });

  describe('array `permission` (OR — any one key held is enough)', () => {
    const entry = [
      { path: '/inbox', titleKey: 'Inbox', order: 1, permission: ['workload:approve', 'syllabus:approve'] },
    ];

    it('shows the entry when the user holds ONLY the first key', () => {
      const tree = buildMenuTree(entry, ['workload:approve'], t);
      expect(tree.map((n) => n.path)).toEqual(['/inbox']);
    });

    it('shows the entry when the user holds ONLY the second key', () => {
      const tree = buildMenuTree(entry, ['syllabus:approve'], t);
      expect(tree.map((n) => n.path)).toEqual(['/inbox']);
    });

    it('hides the entry when the user holds NEITHER key', () => {
      const tree = buildMenuTree(entry, ['workload:read'], t);
      expect(tree).toHaveLength(0);
    });

    it('shows the entry EXACTLY ONCE when the user holds BOTH keys', () => {
      const tree = buildMenuTree(entry, ['workload:approve', 'syllabus:approve'], t);
      expect(tree).toHaveLength(1);
      expect(tree[0]?.path).toBe('/inbox');
    });

    it('respects wildcard grants inside the array check', () => {
      const tree = buildMenuTree(entry, ['*'], t);
      expect(tree.map((n) => n.path)).toEqual(['/inbox']);
    });
  });

  it('prunes a group whose every child was permission-filtered (no empty 404 groups)', () => {
    const tree = buildMenuTree(
      [
        { path: '/admin/structure', titleKey: 'Group', order: 1 },
        { path: '/admin/faculties', titleKey: 'F', order: 2, parent: '/admin/structure', permission: 'faculty:readAll' },
        { path: '/kengash', titleKey: 'Council', order: 3 },
      ],
      ['councilMember:readAll'],
      t,
    );
    expect(tree.map((n) => n.path)).toEqual(['/kengash']);
  });

  it('keeps a group when at least one child survives permission filtering', () => {
    const tree = buildMenuTree(
      [
        { path: '/admin/structure', titleKey: 'Group', order: 1 },
        { path: '/admin/faculties', titleKey: 'F', order: 2, parent: '/admin/structure', permission: 'faculty:readAll' },
        { path: '/admin/groups', titleKey: 'G', order: 3, parent: '/admin/structure', permission: 'group:readAll' },
      ],
      ['faculty:readAll'],
      t,
    );
    expect(tree).toHaveLength(1);
    expect(tree[0]?.children.map((c) => c.path)).toEqual(['/admin/faculties']);
  });
});

describe('buildMenuTree — malformed manifests must not crash', () => {
  it('does NOT crash when a node is its own parent (parent === path)', () => {
    expect(() =>
      buildMenuTree(
        [{ path: '/x', titleKey: 'X', order: 1, parent: '/x' }],
        ALL,
        t,
      ),
    ).not.toThrow();

    const tree = buildMenuTree(
      [{ path: '/x', titleKey: 'X', order: 1, parent: '/x' }],
      ALL,
      t,
    );
    expect(tree).toHaveLength(1);
    expect(tree[0]?.children).toHaveLength(0);
  });

  it('does NOT crash on a route-less group colliding with a self-parent child', () => {
    expect(() =>
      buildMenuTree(
        [
          { path: '/g', titleKey: 'Group', order: 1 },
          { path: '/g', titleKey: 'Dashboard', order: 2, parent: '/g' },
        ],
        ALL,
        t,
      ),
    ).not.toThrow();
  });

  it('does NOT crash on duplicate paths (keeps the first)', () => {
    let tree: ReturnType<typeof buildMenuTree> = [];
    expect(() => {
      tree = buildMenuTree(
        [
          { path: '/dup', titleKey: 'First', order: 1 },
          { path: '/dup', titleKey: 'Second', order: 2 },
        ],
        ALL,
        t,
      );
    }).not.toThrow();
    expect(tree).toHaveLength(1);
    expect(tree[0]?.title).toBe('First');
  });
});
