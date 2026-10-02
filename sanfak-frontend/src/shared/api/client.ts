import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { appConfig } from '../config';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  notifyUnauthorized,
  setAccessToken,
  setRefreshToken,
} from './token-store';

export const apiClient = axios.create({
  baseURL: appConfig.apiUrl,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const AUTH_NO_REFRESH_PATHS = new Set(['/auth', '/auth/refresh', '/auth/logout']);

function isAuthNoRefreshPath(url: string): boolean {
  return AUTH_NO_REFRESH_PATHS.has(url.split('?')[0] ?? url);
}

const REFRESH_LOCK_NAME = 'platform.auth.refresh';
const FALLBACK_LOCK_KEY = 'platform.auth.refresh.lock';
const FALLBACK_LOCK_TTL_MS = 10_000;
const FALLBACK_LOCK_MAX_WAIT_MS = 5_000;

function hasWebLocks(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'locks' in navigator &&
    typeof navigator.locks?.request === 'function'
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface FallbackLockPayload {
  owner: string;
  expiresAt: number;
}

function readFallbackLock(): FallbackLockPayload | null {
  try {
    const raw = localStorage.getItem(FALLBACK_LOCK_KEY);
    return raw ? (JSON.parse(raw) as FallbackLockPayload) : null;
  } catch {
    return null;
  }
}

function tryClaimFallbackLock(owner: string): boolean {
  const existing = readFallbackLock();
  if (existing && existing.expiresAt > Date.now()) return false;
  localStorage.setItem(
    FALLBACK_LOCK_KEY,
    JSON.stringify({ owner, expiresAt: Date.now() + FALLBACK_LOCK_TTL_MS }),
  );
  return true;
}

function releaseFallbackLock(owner: string): void {
  const existing = readFallbackLock();
  if (existing?.owner === owner) localStorage.removeItem(FALLBACK_LOCK_KEY);
}

async function withFallbackLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof localStorage === 'undefined') return fn();
  const owner = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const deadline = Date.now() + FALLBACK_LOCK_MAX_WAIT_MS;
  while (!tryClaimFallbackLock(owner)) {
    if (Date.now() >= deadline) break;
    await sleep(50 + Math.random() * 100);
  }
  try {
    return await fn();
  } finally {
    releaseFallbackLock(owner);
  }
}

async function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  if (hasWebLocks()) return navigator.locks.request(REFRESH_LOCK_NAME, fn);
  return withFallbackLock(fn);
}

let refreshPromise: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  const tokenBeforeLock = getAccessToken();

  return withRefreshLock(async () => {
    const tokenAfterLock = getAccessToken();
    if (tokenAfterLock && tokenAfterLock !== tokenBeforeLock) {
      return tokenAfterLock;
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    try {
      const res = await axios.post(
        `${appConfig.apiUrl}/auth/refresh`,
        { refreshToken },
        { withCredentials: true },
      );
      const token = res.data?.accessToken ?? null;
      setAccessToken(token);
      if (res.data?.refreshToken) setRefreshToken(res.data.refreshToken);
      return token;
    } catch {
      clearTokens();
      return null;
    }
  });
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;
    const status = error.response?.status;
    const url = original?.url ?? '';

    if (status === 401 && original && !original._retry && !isAuthNoRefreshPath(url)) {
      original._retry = true;
      refreshPromise = refreshPromise ?? refreshAccessToken();
      const token = await refreshPromise;
      refreshPromise = null;

      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return apiClient(original);
      }
      notifyUnauthorized();
    }

    return Promise.reject(error);
  },
);
