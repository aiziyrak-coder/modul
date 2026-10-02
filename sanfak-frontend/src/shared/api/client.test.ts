import { beforeEach, describe, expect, it } from 'vitest';
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { apiClient, refreshAccessToken } from './client';
import { clearTokens, getAccessToken, getRefreshToken, setAccessToken, setRefreshToken } from './token-store';
import { appConfig } from '../config';

const REFRESH_URL = `${appConfig.apiUrl}/auth/refresh`;

interface FakeResponse {
  status: number;
  data?: unknown;
}

const calls: Array<{ url: string; headers: Record<string, string> }> = [];
const queues = new Map<string, FakeResponse[]>();

function queueResponse(url: string, response: FakeResponse): void {
  const q = queues.get(url) ?? [];
  q.push(response);
  queues.set(url, q);
}

function fakeAdapter(config: InternalAxiosRequestConfig) {
  const url = config.url ?? '';
  calls.push({ url, headers: { ...(config.headers as unknown as Record<string, string>) } });
  const q = queues.get(url);
  const next = q?.shift() ?? { status: 200, data: {} };
  if (next.status >= 200 && next.status < 300) {
    return Promise.resolve({
      data: next.data,
      status: next.status,
      statusText: 'OK',
      headers: {},
      config,
    });
  }
  return Promise.reject(
    new AxiosError('Request failed', undefined, config, undefined, {
      data: next.data,
      status: next.status,
      statusText: 'Error',
      headers: {},
      config,
    }),
  );
}

apiClient.defaults.adapter = fakeAdapter;
axios.defaults.adapter = fakeAdapter;

beforeEach(() => {
  clearTokens();
  localStorage.removeItem('platform.auth.refresh.lock');
  calls.length = 0;
  queues.clear();
});

describe('B1 — 401 qorovul AYNAN yo\'l bo\'yicha (substring emas)', () => {
  it('/auth/profile 401 → refresh chaqiriladi → retry 200 → sessiya saqlanadi', async () => {
    setAccessToken('old-token');
    setRefreshToken('refresh-1');
    queueResponse('/auth/profile', { status: 401 });
    queueResponse(REFRESH_URL, { status: 200, data: { accessToken: 'new-token', refreshToken: 'refresh-2' } });
    queueResponse('/auth/profile', { status: 200, data: { firstName: 'Ali' } });

    const res = await apiClient.get('/auth/profile');

    expect(res.data).toEqual({ firstName: 'Ali' });
    const profileCalls = calls.filter((c) => c.url === '/auth/profile');
    expect(profileCalls).toHaveLength(2);
    expect(calls.filter((c) => c.url === REFRESH_URL)).toHaveLength(1);
    expect(profileCalls[1]?.headers.Authorization).toBe('Bearer new-token');
    expect(getAccessToken()).toBe('new-token');
    expect(getRefreshToken()).toBe('refresh-2');
  });

  it.each(['/auth', '/auth/refresh', '/auth/logout'])(
    '%s 401 → refresh CHAQIRILMAYDI (xato to\'g\'ridan-to\'g\'ri qaytadi)',
    async (url) => {
      setAccessToken('old-token');
      setRefreshToken('refresh-1');
      queueResponse(url, { status: 401 });

      await expect(apiClient.get(url)).rejects.toMatchObject({ response: { status: 401 } });

      expect(calls.filter((c) => c.url === url)).toHaveLength(1);
      expect(calls.filter((c) => c.url === REFRESH_URL)).toHaveLength(0);
    },
  );

  it('boshqa modul endpointi (/auth ichida EMAS) — oddiy 401 ham refresh qiladi', async () => {
    setAccessToken('old-token');
    setRefreshToken('refresh-1');
    queueResponse('/working-schedules', { status: 401 });
    queueResponse(REFRESH_URL, { status: 200, data: { accessToken: 'tt', refreshToken: 'rr' } });
    queueResponse('/working-schedules', { status: 200, data: [] });

    await apiClient.get('/working-schedules');

    expect(calls.filter((c) => c.url === REFRESH_URL)).toHaveLength(1);
  });
});

describe('B2 — tab-lararo qulf (fallback yo\'l, jsdom\'da Web Locks yo\'q)', () => {
  it('ikki parallel refreshAccessToken() → backend BIR marta chaqiriladi', async () => {
    setAccessToken('old-access');
    setRefreshToken('refresh-1');
    queueResponse(REFRESH_URL, { status: 200, data: { accessToken: 'new-access', refreshToken: 'refresh-2' } });

    const [tokenA, tokenB] = await Promise.all([refreshAccessToken(), refreshAccessToken()]);

    expect(calls.filter((c) => c.url === REFRESH_URL)).toHaveLength(1);
    expect(tokenA).toBe('new-access');
    expect(tokenB).toBe('new-access');
    expect(getRefreshToken()).toBe('refresh-2');
  });

  it('refresh token yo\'q bo\'lsa — tarmoqqa chiqmasdan `null` qaytaradi', async () => {
    clearTokens();

    const token = await refreshAccessToken();

    expect(token).toBeNull();
    expect(calls.filter((c) => c.url === REFRESH_URL)).toHaveLength(0);
  });
});
