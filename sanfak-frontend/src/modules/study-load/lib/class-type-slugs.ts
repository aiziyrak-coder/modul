export type Translate = (key: string, options?: Record<string, unknown>) => string;

export const CLASS_TYPE_SLUG_LABEL_KEYS: Readonly<Record<string, string>> = {
  maruza: 'studyLoad.myWorkload.classType.lecture',
  klinik_amaliyot: 'studyLoad.myWorkload.classType.clinicalPractice',
  seminar: 'studyLoad.myWorkload.classType.seminar',
  laboratoriya: 'studyLoad.myWorkload.classType.labTraining',
  amaliy: 'studyLoad.myWorkload.classType.practical',
};

export const SCALAR_OWNER_ORDER: readonly string[] = [
  'amaliy',
  'seminar',
  'laboratoriya',
  'klinik_amaliyot',
];

export interface PlannedClassType {
  slug: string;
  title: string;
}

export function classTypeSlugLabel(t: Translate, slug: string, title?: string | null): string {
  if (title) return title;
  const key = CLASS_TYPE_SLUG_LABEL_KEYS[slug];
  return key ? t(key) : slug;
}

export function classTypeSlugsLabel(t: Translate, slugs: readonly string[]): string {
  return slugs.map((slug) => classTypeSlugLabel(t, slug)).join(', ');
}

export function plannedClassTypes(
  t: Translate,
  classTypes: ReadonlyArray<{ slug: string; title?: string | null; stream: number }>,
): PlannedClassType[] {
  return classTypes
    .filter((ct) => (Number(ct.stream) || 0) > 0 && ct.slug)
    .map((ct) => ({ slug: ct.slug, title: classTypeSlugLabel(t, ct.slug, ct.title) }));
}

export function scalarOwnerSlug(plannedSlugs: readonly string[]): string | null {
  for (const slug of SCALAR_OWNER_ORDER) {
    if (plannedSlugs.includes(slug)) return slug;
  }
  return plannedSlugs.length > 0 ? plannedSlugs[0]! : null;
}

export function classTypeSlugsPayload(
  selected: readonly string[],
  plannedSlugs: readonly string[],
): string[] | undefined {
  if (plannedSlugs.length === 0 || selected.length === 0) return undefined;
  const isSubset = plannedSlugs.some((slug) => !selected.includes(slug));
  return isSubset ? plannedSlugs.filter((slug) => selected.includes(slug)) : undefined;
}

export const LECTURE_SLUG = 'maruza';

export function withAutoStream<T extends { number: number; groups: string[]; language?: string | null }>(
  selected: readonly string[],
  groups: readonly string[],
  streams: readonly T[],
): T[] | undefined {
  const effective = streams.filter((s) => s.groups.length > 0);
  if (effective.length > 0) return [...streams];
  if (selected.includes(LECTURE_SLUG) && groups.length > 0) {
    return [{ number: 1, groups: [...groups], language: null } as T];
  }
  return streams.length > 0 ? [...streams] : undefined;
}

export function classTypesIntersect(a: readonly string[], b: readonly string[]): boolean {
  if (a.length === 0 || b.length === 0) return true;
  return a.some((slug) => b.includes(slug));
}
