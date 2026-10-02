import type { ScienceProgramFormVersion } from '../model/types';

export type FormVersionFilterValue = ScienceProgramFormVersion;

export function filterByFormVersion<T extends { formVersion: ScienceProgramFormVersion }>(
  items: T[],
  version: FormVersionFilterValue | undefined,
): T[] {
  if (!version) return items;
  return items.filter((item) => item.formVersion === version);
}

export function toFormVersionFilter(raw: string | undefined): FormVersionFilterValue | undefined {
  if (raw === 'v142') return 'v142';
  if (raw === 'v259') return 'v259';
  return undefined;
}
