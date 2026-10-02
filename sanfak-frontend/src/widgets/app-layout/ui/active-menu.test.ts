import { describe, it, expect } from 'vitest';
import type { MenuNode } from '@/app/modules/build-menu';
import { findActiveMenuEntry } from './active-menu';

const distribution: MenuNode = {
  path: '/study-load/distributions',
  title: 'Taqsimot',
  order: 204,
  children: [],
};

const vacancy: MenuNode = {
  path: '/study-load/distributions/vacancies',
  title: 'Vakant yuklamalar reyestri',
  order: 204.5,
  children: [],
};

const flatSiblings: MenuNode[] = [distribution, vacancy];

describe('findActiveMenuEntry — flat sibling prefix collision (study-load)', () => {
  it('(a) on /study-load/distributions — resolves Taqsimot only', () => {
    const entry = findActiveMenuEntry(flatSiblings, '/study-load/distributions');
    expect(entry?.path).toBe(distribution.path);
    expect(entry?.title).toBe('Taqsimot');
  });

  it('(b) on /study-load/distributions/vacancies — resolves ONLY Vakant, never Taqsimot', () => {
    const entry = findActiveMenuEntry(flatSiblings, '/study-load/distributions/vacancies');
    expect(entry?.path).toBe(vacancy.path);
    expect(entry?.title).toBe('Vakant yuklamalar reyestri');
    expect(entry?.path).not.toBe(distribution.path);
  });

  it('(c) on an unrelated route — resolves neither', () => {
    const entry = findActiveMenuEntry(flatSiblings, '/admin/users');
    expect(entry).toBeUndefined();
  });

  it('still resolves an exact-match leaf that has no colliding sibling', () => {
    const entry = findActiveMenuEntry([distribution], '/study-load/distributions');
    expect(entry?.path).toBe(distribution.path);
  });

  it('a deeper unrelated route under the shorter sibling still resolves the longer one', () => {
    const entry = findActiveMenuEntry(flatSiblings, '/study-load/distributions-archive');
    expect(entry).toBeUndefined();
  });
});

describe('findActiveMenuEntry — declared group, active child (must not regress)', () => {
  const group: MenuNode = {
    path: '/teacher/work-plans-group',
    title: 'Ish rejalar',
    order: 100,
    children: [
      { path: '/teacher/work-plans', title: 'Shaxsiy ish reja', order: 0, children: [] },
      { path: '/teacher/work-plans/completed', title: 'Bajarilgan ish rejalar', order: 1, children: [] },
      { path: '/teacher/work-plans/monitoring', title: 'Monitoring', order: 2, children: [] },
      { path: '/teacher/work-plans/reports', title: 'Fakultet hisobotlari', order: 3, children: [] },
    ],
  };

  it('(d) resolves the specific active child, not the shorter sibling that prefixes it', () => {
    const entry = findActiveMenuEntry([group], '/teacher/work-plans/monitoring');
    expect(entry?.path).toBe('/teacher/work-plans/monitoring');
    expect(entry?.title).toBe('Monitoring');
  });

  it('(d) the resolved leaf belongs to the group — sidebar keeps the parent row highlighted/open', () => {
    const entry = findActiveMenuEntry([group], '/teacher/work-plans/monitoring');
    expect(group.children.some((c) => c.path === entry?.path)).toBe(true);
  });

  it('resolves the group-anchor child itself when its own (shortest) route is the active one', () => {
    const entry = findActiveMenuEntry([group], '/teacher/work-plans');
    expect(entry?.path).toBe('/teacher/work-plans');
  });
});
