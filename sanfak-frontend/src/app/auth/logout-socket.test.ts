import { describe, expect, it } from 'vitest';

const sources = import.meta.glob('../{session/session-store,auth/use-auth,providers/index}.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const read = (fragment: string) => {
  const entry = Object.entries(sources).find(([p]) => p.includes(fragment));
  expect(entry, `${fragment} topilmadi`).toBeDefined();
  return entry![1];
};

describe('sessiya tugadi → socket yopiladi', () => {
  const store = () => read('session-store.ts');

  it('`disconnectAppSocket` session-store`ga import qilingan', () => {
    expect(store()).toMatch(/import \{ disconnectAppSocket \} from '@\/shared\/lib\/socket'/);
  });

  it('`clear()` ichida CHAQIRILADI (yagona nuqta)', () => {
    const src = store();
    const body = src.slice(src.indexOf('clear: ()'));
    expect(body).toContain('disconnectAppSocket()');
  });

  it('menyudagi "Chiqish" sessiyani tozalaydi → uzish shu orqali', () => {
    const src = read('use-auth.ts');
    const body = src.slice(src.indexOf('const logout ='), src.indexOf('const bootstrap ='));
    expect(body).toContain('clearTokens()');
    expect(body).toContain('clearSession()');
    expect(body.indexOf('clearTokens()')).toBeLessThan(body.indexOf('clearSession()'));
  });

  it('401 → avto-chiqish ham SHU nuqtadan o`tadi', () => {
    const src = read('providers/index.tsx');
    const body = src.slice(src.indexOf('setUnauthorizedHandler('));
    expect(body).toContain('clear()');
  });
});
