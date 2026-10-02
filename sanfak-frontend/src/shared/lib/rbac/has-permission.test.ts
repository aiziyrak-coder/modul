import { describe, it, expect } from 'vitest';
import { hasAllPermissions, hasAnyPermission, hasPermission, permissionMatches } from './has-permission';

describe('permissionMatches', () => {
  it('matches exact keys and the global wildcard', () => {
    expect(permissionMatches('users:user:read', 'users:user:read')).toBe(true);
    expect(permissionMatches('*', 'anything')).toBe(true);
    expect(permissionMatches('users:user:read', 'users:user:create')).toBe(false);
  });

  it('matches module/resource wildcards but not different modules', () => {
    expect(permissionMatches('inventory:*', 'inventory:item:read')).toBe(true);
    expect(permissionMatches('inventory:item:*', 'inventory:item:update')).toBe(true);
    expect(permissionMatches('inventory:*', 'users:user:read')).toBe(false);
    expect(permissionMatches('inv:*', 'inventory:item:read')).toBe(false);
  });
});

describe('hasPermission helpers', () => {
  it('hasPermission finds a match', () => {
    expect(hasPermission(['inventory:*'], 'inventory:item:read')).toBe(true);
    expect(hasPermission(['dashboard:view'], 'inventory:item:read')).toBe(false);
  });

  it('hasAny / hasAll behave as expected', () => {
    expect(hasAnyPermission(['users:*'], ['x:y:z', 'users:user:read'])).toBe(true);
    expect(hasAllPermissions(['users:*'], ['users:user:read', 'users:role:read'])).toBe(true);
    expect(hasAllPermissions(['users:*'], ['users:user:read', 'inventory:item:read'])).toBe(false);
  });
});
