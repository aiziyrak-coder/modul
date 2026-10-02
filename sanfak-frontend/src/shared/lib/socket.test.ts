import { describe, expect, it } from 'vitest';

const sources = import.meta.glob('./socket.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const src = Object.values(sources)[0];
if (!src) throw new Error('socket.ts topilmadi (import.meta.glob)');

describe('socket.ts — connect_error auth-refresh (manba tekshiruvi)', () => {
  it('AUTH_CONNECT_ERROR_MESSAGES aynan backend ikki xabarini o\'z ichiga oladi', () => {
    expect(src).toContain(`AUTH_CONNECT_ERROR_MESSAGES = new Set(["Token topilmadi", "Token noto'g'ri"])`);
  });

  it('`connect_error` listener ro\'yxatdan o\'tkaziladi va `handleConnectError`ga yo\'naltiradi', () => {
    expect(src).toMatch(/socket\.on\('connect_error',\s*\(error: Error\) => \{\s*void handleConnectError\(error\);/);
  });

  it('`handleConnectError`: auth-emas xato yoki allaqachon ketayotgan urinish — DARHOL chiqadi', () => {
    const body = src.slice(src.indexOf('async function handleConnectError'));
    expect(body).toContain('if (!AUTH_CONNECT_ERROR_MESSAGES.has(error.message) || reconnectRefreshInFlight) return;');
  });

  it('`handleConnectError`: `refreshAccessToken()` chaqiradi, MUVAFFAQIYATLI bo\'lsa VA ulanmagan bo\'lsa `connect()`', () => {
    const body = src.slice(
      src.indexOf('async function handleConnectError'),
      src.indexOf('export function getAppSocket'),
    );
    expect(body).toContain('const token = await refreshAccessToken();');
    expect(body).toContain('if (token && socket && !socket.connected) socket.connect();');
    expect(body).toContain('reconnectRefreshInFlight = false;');
  });
});
