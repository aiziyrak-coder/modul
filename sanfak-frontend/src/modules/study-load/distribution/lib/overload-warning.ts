import type { OverloadWarning } from '../api/distribution-api';

export function buildOverloadWarningMessage(
  t: (key: string, options?: Record<string, unknown>) => string,
  warnings: OverloadWarning[] | undefined,
): string | null {
  if (!warnings?.length) return null;

  return t('studyLoad.distribution.overloadWarning', {
    count: warnings.length,
    excess: Math.max(...warnings.map((w) => w.excess)),
  });
}
