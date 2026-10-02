import { getAccessToken } from './token-store';
import { refreshAccessToken } from './client';

const REFRESH_MARGIN_MS = 60_000;

let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;

function clearTimer(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

function decodeExpMs(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json =
      typeof atob === 'function'
        ? atob(padded)
        : Buffer.from(padded, 'base64').toString('utf-8');
    const decoded = JSON.parse(json) as { exp?: unknown };
    return typeof decoded.exp === 'number' ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

function isTabHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

async function triggerRefresh(): Promise<void> {
  if (isTabHidden()) return;
  const newToken = await refreshAccessToken();
  if (!newToken) return;
  scheduleFromToken(newToken);
}

function scheduleFromToken(token: string | null): void {
  clearTimer();
  if (!token) return;
  const expMs = decodeExpMs(token);
  if (expMs === null) return;
  const delay = Math.max(expMs - REFRESH_MARGIN_MS - Date.now(), 0);
  timer = setTimeout(() => {
    void triggerRefresh();
  }, delay);
}

function handleVisibilityOrFocus(): void {
  if (isTabHidden()) return;
  const token = getAccessToken();
  if (!token) return;
  const expMs = decodeExpMs(token);
  if (expMs === null) return;
  if (expMs - Date.now() < REFRESH_MARGIN_MS) {
    void triggerRefresh();
  } else {
    scheduleFromToken(token);
  }
}

function handleStorage(): void {
  scheduleFromToken(getAccessToken());
}

export function startTokenRefreshScheduler(): void {
  if (started) return;
  started = true;
  scheduleFromToken(getAccessToken());
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('storage', handleStorage);
  }
}

export function stopTokenRefreshScheduler(): void {
  started = false;
  clearTimer();
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('focus', handleVisibilityOrFocus);
    window.removeEventListener('storage', handleStorage);
  }
}
