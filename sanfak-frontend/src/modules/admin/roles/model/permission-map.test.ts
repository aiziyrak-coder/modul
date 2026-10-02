import { describe, expect, it } from 'vitest';
import { permissionsToMap, mapToPermissions } from './permission-map';

describe('permission-map', () => {
  it('permissionsToMap section → Set xaritasini quradi', () => {
    const map = permissionsToMap([{ section: 'user', actionKeys: ['create', 'readAll'] }]);
    const set = map.user;
    expect(set).toBeInstanceOf(Set);
    expect([...(set ?? new Set<string>())]).toEqual(['create', 'readAll']);
  });

  it('round-trip: permissions → map → permissions o\'zgarmaydi', () => {
    const input = [
      { section: 'user', actionKeys: ['create', 'read'] },
      { section: 'role', actionKeys: ['readAll'] },
    ];
    expect(mapToPermissions(permissionsToMap(input))).toEqual(input);
  });

  it('mapToPermissions bo\'sh Set\'li seksiyalarni tashlab yuboradi', () => {
    const map = { user: new Set<string>(), role: new Set(['readAll']) };
    expect(mapToPermissions(map)).toEqual([{ section: 'role', actionKeys: ['readAll'] }]);
  });
});
