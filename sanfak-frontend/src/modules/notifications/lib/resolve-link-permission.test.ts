import { describe, expect, it } from 'vitest';
import { resolveLinkPermission } from './resolve-link-permission';

describe('resolveLinkPermission — matching route with a permission', () => {
  it('literal path → the permission that route declares', () => {
    expect(resolveLinkPermission('/task-management/tasks')).toBe('task:create');
  });
});

describe('resolveLinkPermission — `:id` dynamic segment', () => {
  it('a numeric id in place of `:id` still resolves the same permission', () => {
    expect(resolveLinkPermission('/task-management/tasks/123')).toBe('task:read');
  });

  it('two different dynamic routes under the same base do not cross-resolve', () => {
    expect(resolveLinkPermission('/task-management/my-tasks/42')).toBe('task:read');
    expect(resolveLinkPermission('/task-management/my-tasks')).toBe('task:readAll');
  });
});

describe('resolveLinkPermission — no matching route', () => {
  it('a path pattern the module does not declare → null (navigate proceeds, spec fallback)', () => {
    expect(resolveLinkPermission('/task-management/does-not-exist')).toBeNull();
  });

  it('a namespace no module owns at all → null', () => {
    expect(resolveLinkPermission('/comments/5')).toBeNull();
  });
});

describe('resolveLinkPermission — matched route without a `permission` field', () => {
  it('a universal (ungated) route → null, not a made-up key', () => {
    expect(resolveLinkPermission('/task-management/dashboard')).toBeNull();
  });
});

describe('resolveLinkPermission — edge inputs', () => {
  it('null / empty → null', () => {
    expect(resolveLinkPermission(null)).toBeNull();
    expect(resolveLinkPermission('')).toBeNull();
  });

  it('query string is stripped before matching (study-load `distributions?query` — link-guard repair target)', () => {
    expect(resolveLinkPermission('/study-load/distributions?needsRecalculation=true')).toBe(
      'workloadDistribution:readAll',
    );
  });

  it('a literal route wins over a same-shaped `:id` route for the exact same path length (study-load `distributions/vacancies` vs. `distributions/:id`)', () => {
    expect(resolveLinkPermission('/study-load/distributions/vacancies')).toBe(
      'workloadDistribution:readAll',
    );
    expect(resolveLinkPermission('/study-load/distributions/9')).toBe('workloadDistribution:read');
  });
});
