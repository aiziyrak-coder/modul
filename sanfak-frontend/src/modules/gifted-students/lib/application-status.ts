export const REVIEW_PASSED = 'recommended';

export const REVIEW_PASSED_BACKEND = 'approved';

export function isReviewPassed(status: string | undefined | null): boolean {
  return status === REVIEW_PASSED || status === REVIEW_PASSED_BACKEND;
}

export const ACTIVE_APPLICATION_STATUSES = ['pending', REVIEW_PASSED, REVIEW_PASSED_BACKEND];

export function isActiveApplication(status: string | undefined | null): boolean {
  return !!status && ACTIVE_APPLICATION_STATUSES.includes(status);
}

export function pickVisibleApplication<T extends { status: string }>(apps: T[]): T | null {
  if (apps.length === 0) return null;
  const active = apps.filter((a) => isActiveApplication(a.status));
  const pool = active.length > 0 ? active : apps;
  return pool[pool.length - 1] ?? null;
}
