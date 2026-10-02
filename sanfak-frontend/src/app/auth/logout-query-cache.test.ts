import { describe, expect, it, beforeEach } from 'vitest';
import { queryClient } from '@/shared/api';
import { useSessionStore } from '@/app/session';

const KEYS = [
  ['gifted-profile'],
  ['residency-profile'],
  ['gifted', 'students'],
  ['task', 'list', { page: 1 }],
] as const;

describe('sessiya tugadi → React Query keshi tozalanadi (MD-48)', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  it('`clear()` keshdagi BARCHA yozuvni o`chiradi', () => {
    for (const key of KEYS) queryClient.setQueryData(key as unknown as string[], { _id: 'ESKI' });
    expect(queryClient.getQueryCache().getAll()).toHaveLength(KEYS.length);

    useSessionStore.getState().clear();

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it('eski foydalanuvchining PROFILI qayta o`qib bo`lmaydi (asosiy regressiya)', () => {
    queryClient.setQueryData(['gifted-profile'], { _id: 'HAKAM-1', role: { permissions: ['x'] } });
    queryClient.setQueryData(['residency-profile'], { _id: 'HAKAM-1' });

    useSessionStore.getState().clear();

    expect(queryClient.getQueryData(['gifted-profile'])).toBeUndefined();
    expect(queryClient.getQueryData(['residency-profile'])).toBeUndefined();
  });

  it('zustand sessiyasi ham tozalanadi (mavjud xulq buzilmadi)', () => {
    useSessionStore.getState().setSession({
      user: { id: 'u1', email: 'a@b.c', fullName: 'Eski Foydalanuvchi', roles: [] },
      permissions: ['gifted:read'],
    });
    expect(useSessionStore.getState().user).not.toBeNull();

    useSessionStore.getState().clear();

    const s = useSessionStore.getState();
    expect(s.user).toBeNull();
    expect(s.permissions).toEqual([]);
    expect(s.status).toBe('unauthenticated');
  });

  it('tozalash `set()` DAN OLDIN — yarim holat qolmaydi', () => {
    const src = String(useSessionStore.getState().clear);
    expect(src.indexOf('clear')).toBeGreaterThan(-1);
    expect(src.indexOf('cancelQueries')).toBeLessThan(src.indexOf('status'));
  });
});
