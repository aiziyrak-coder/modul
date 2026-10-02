import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAccessToken, setAccessToken, clearTokens } from './token-store';
import { startTokenRefreshScheduler, stopTokenRefreshScheduler } from './token-refresh-scheduler';
import * as clientModule from './client';

const refreshAccessTokenMock = vi.spyOn(clientModule, 'refreshAccessToken');

function makeToken(expUnixSeconds: number): string {
  const b64 = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString('base64').replace(/=+$/, '');
  return `${b64({ alg: 'none' })}.${b64({ exp: expUnixSeconds })}.sig`;
}

beforeEach(() => {
  vi.useFakeTimers();
  refreshAccessTokenMock.mockReset();
  clearTokens();
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'visible',
  });
});

afterEach(() => {
  stopTokenRefreshScheduler();
  vi.useRealTimers();
});

describe('startTokenRefreshScheduler — proaktiv (exp - 60s)', () => {
  it('exp - 60s vaqtida refreshAccessToken chaqiradi', async () => {
    const nowMs = Date.now();
    setAccessToken(makeToken((nowMs + 70_000) / 1000));
    refreshAccessTokenMock.mockResolvedValue(null);

    startTokenRefreshScheduler();
    expect(refreshAccessTokenMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(9_999);
    expect(refreshAccessTokenMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2);
    expect(refreshAccessTokenMock).toHaveBeenCalledTimes(1);
  });

  it('token yo\'q bo\'lsa timer qo\'yilmaydi (chaqirilmaydi)', async () => {
    startTokenRefreshScheduler();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(refreshAccessTokenMock).not.toHaveBeenCalled();
  });

  it('tab yashirin bo\'lsa muddat kelsa ham chaqirmaydi', async () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    setAccessToken(makeToken((Date.now() + 65_000) / 1000));
    refreshAccessTokenMock.mockResolvedValue(null);

    startTokenRefreshScheduler();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(refreshAccessTokenMock).not.toHaveBeenCalled();
  });

  it('stop() dan keyin timer chaqirilmaydi', async () => {
    setAccessToken(makeToken((Date.now() + 65_000) / 1000));
    refreshAccessTokenMock.mockResolvedValue(null);

    startTokenRefreshScheduler();
    stopTokenRefreshScheduler();
    await vi.advanceTimersByTimeAsync(120_000);

    expect(refreshAccessTokenMock).not.toHaveBeenCalled();
  });
});

describe('visibilitychange/focus — tab qaytganda muddat tekshiriladi', () => {
  it('fokusda muddati yaqin token bo\'lsa DARHOL yangilaydi', async () => {
    setAccessToken(makeToken((Date.now() + 600_000) / 1000));
    startTokenRefreshScheduler();
    expect(refreshAccessTokenMock).not.toHaveBeenCalled();

    setAccessToken(makeToken((Date.now() + 30_000) / 1000));
    refreshAccessTokenMock.mockResolvedValue(null);

    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(0);

    expect(refreshAccessTokenMock).toHaveBeenCalledTimes(1);
  });

  it('fokusda muddat hali uzoq bo\'lsa chaqirmaydi — faqat qayta rejalashtiradi', async () => {
    setAccessToken(makeToken((Date.now() + 600_000) / 1000));
    startTokenRefreshScheduler();

    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(0);

    expect(refreshAccessTokenMock).not.toHaveBeenCalled();
  });

  it('tab yashirinda fokus/visibility hodisasi e\'tiborsiz qoldiriladi', async () => {
    setAccessToken(makeToken((Date.now() + 30_000) / 1000));
    startTokenRefreshScheduler();

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);

    expect(refreshAccessTokenMock).not.toHaveBeenCalled();
  });
});

describe('storage hodisasi — boshqa tab tokenni yangilasa qayta rejalashtiriladi', () => {
  it('yangi (uzoqroq muddatli) token kelsa eski qisqa timer bekor qilinadi', async () => {
    setAccessToken(makeToken((Date.now() + 65_000) / 1000));
    refreshAccessTokenMock.mockResolvedValue(null);
    startTokenRefreshScheduler();

    setAccessToken(makeToken((Date.now() + 600_000) / 1000));
    window.dispatchEvent(new StorageEvent('storage', { key: 'platform.accessToken' }));

    await vi.advanceTimersByTimeAsync(10_000);
    expect(refreshAccessTokenMock).not.toHaveBeenCalled();
  });

  it('token o\'chirilsa (logout boshqa tabda) timer bekor bo\'ladi', async () => {
    setAccessToken(makeToken((Date.now() + 65_000) / 1000));
    startTokenRefreshScheduler();

    clearTokens();
    window.dispatchEvent(new StorageEvent('storage', { key: 'platform.accessToken' }));

    await vi.advanceTimersByTimeAsync(120_000);
    expect(refreshAccessTokenMock).not.toHaveBeenCalled();
    expect(getAccessToken()).toBeNull();
  });
});
