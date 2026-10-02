import { describe, expect, it } from 'vitest';
import { buildModuleRoutes } from './build-routes';

describe('buildModuleRoutes', () => {
  it('mounts the foreign-admission module under its namespace', () => {
    const { protectedRoutes } = buildModuleRoutes();
    const paths = protectedRoutes.map((r) => r.path);
    expect(paths).toContain('foreign-admission');
  });

  it('keeps protected namespaces unique (collisions throw at module load)', () => {
    const { protectedRoutes } = buildModuleRoutes();
    const paths = protectedRoutes.map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('returns separate buckets for public and protected routes', () => {
    const bundle = buildModuleRoutes();
    expect(bundle).toHaveProperty('publicRoutes');
    expect(bundle).toHaveProperty('protectedRoutes');
    expect(Array.isArray(bundle.publicRoutes)).toBe(true);
    expect(Array.isArray(bundle.protectedRoutes)).toBe(true);
  });

  it('mounts a declared public route at the top level, outside the app shell', () => {
    const { publicRoutes, protectedRoutes } = buildModuleRoutes();
    const paths = publicRoutes.map((r) => r.path);
    expect(paths).toContain('/science-council/ariza');

    const scienceCouncil = protectedRoutes.find((r) => r.path === 'science-council');
    const childPaths = (scienceCouncil?.children ?? []).map((c) => c.path);
    expect(childPaths).not.toContain('ariza');
  });
});
