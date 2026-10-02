import type { TFunction } from 'i18next';
import { lookupClassType, lookupStudyWorkItem } from '../../api/mapper';
import type { WorkloadBlockOption } from '../../model/types';

export interface ClassTypeItem {
  slug: string;
  title: string;
  stream: number | null;
  total: number;
  backendSlug?: string | null;
}

interface ClassTypeRow {
  slug: string;
  titleKey: string;
  canonical: string;
  slugFallback: string;
  kind: 'classType' | 'item';
}

export const CLASS_TYPE_ROWS: ClassTypeRow[] = [
  { slug: 'maruza', titleKey: 'studyLoad.distribution.table.lecture', canonical: 'lecture', slugFallback: 'maruza', kind: 'classType' },
  { slug: 'klinik', titleKey: 'studyLoad.distribution.table.clinical', canonical: 'clinical_practice', slugFallback: 'klinik_amaliyot', kind: 'classType' },
  { slug: 'laboratoriya', titleKey: 'studyLoad.distribution.table.lab', canonical: 'lab_training', slugFallback: 'laboratoriya', kind: 'classType' },
  { slug: 'amaliy', titleKey: 'studyLoad.distribution.assign.classTypeAmaliy', canonical: 'practical', slugFallback: 'amaliy', kind: 'classType' },
  { slug: 'oraliq', titleKey: 'studyLoad.distribution.table.oraliq', canonical: 'student_work', slugFallback: 'on', kind: 'item' },
  { slug: 'yakuniy', titleKey: 'studyLoad.distribution.table.yakuniy', canonical: 'yan', slugFallback: 'yan', kind: 'item' },
  { slug: 'qoldirilgan', titleKey: 'studyLoad.distribution.assign.classTypeQoldirilgan', canonical: 'missed_lesson', slugFallback: 'qoldirilgan', kind: 'item' },
  { slug: 'malakaviy', titleKey: 'studyLoad.distribution.table.malakaviy', canonical: 'skilled_practice', slugFallback: 'malakaviy', kind: 'item' },
];

export function buildBlockLabel(
  t: TFunction,
  block: Pick<WorkloadBlockOption, 'scienceName' | 'course' | 'semester' | 'totalHour'>,
): string {
  const namePart = [
    block.scienceName,
    block.course > 0 ? t('studyLoad.common.courseN', { n: block.course }) : null,
    t('studyLoad.common.semesterN', { n: block.semester }),
  ]
    .filter(Boolean)
    .join(', ');
  return [namePart, t('studyLoad.common.hoursN', { n: block.totalHour })].join(' — ');
}

export function buildClassTypeItems(
  t: TFunction,
  block: Pick<WorkloadBlockOption, 'classTypes' | 'studyWorkItems'> | undefined,
): ClassTypeItem[] {
  if (!block) return [];
  return CLASS_TYPE_ROWS.map((row) => {
    const title = t(row.titleKey);
    if (row.kind === 'classType') {
      const ct = lookupClassType(block.classTypes, row.canonical, row.slugFallback);
      return { slug: row.slug, title, stream: ct.stream, total: ct.total, backendSlug: row.slugFallback };
    }
    const value = lookupStudyWorkItem(block.studyWorkItems, row.canonical, row.slugFallback);
    return { slug: row.slug, title, stream: null, total: value, backendSlug: null };
  });
}

export function countEffectiveStreams(
  streams: ReadonlyArray<{ groups?: readonly string[] }>,
): number {
  return streams.filter((st) => (st.groups?.length ?? 0) > 0).length;
}

export function recalcClassTypeItems(
  items: ClassTypeItem[],
  streamCount: number,
  groupCount: number,
): ClassTypeItem[] {
  return items.map((item) => {
    if (item.stream === null) return item;
    const row = CLASS_TYPE_ROWS.find((r) => r.slug === item.slug);
    const multiplier = row?.canonical === 'lecture' ? streamCount : groupCount;
    return { ...item, total: item.stream * multiplier };
  });
}

export const ON_MIN_AUDITORIUM_HOURS = 71.99;
export const AUTO_ITEM_COEFFICIENTS: Readonly<Record<string, number>> = Object.freeze({
  oraliq: 0.2,
  yakuniy: 0.15,
  qoldirilgan: 0.1,
});

export function planAuditoriumOf(items: ReadonlyArray<ClassTypeItem>): number {
  return items.reduce((sum, it) => sum + (it.stream ?? 0), 0);
}

export function toCourseSemester(globalSemester: number | null | undefined): 1 | 2 {
  const n = Number(globalSemester);
  if (!Number.isInteger(n) || n < 1) return 1;
  return ((((n - 1) % 2) + 1) as 1 | 2);
}

export function recalcScalarItems(
  items: ClassTypeItem[],
  studentCount: number,
  opts: { isLastSemester: boolean },
): ClassTypeItem[] {
  const planAuditorium = planAuditoriumOf(items);
  const eligible = (slug: string): boolean => {
    if (slug === 'oraliq') return planAuditorium > ON_MIN_AUDITORIUM_HOURS;
    if (slug === 'yakuniy') return opts.isLastSemester;
    return true;
  };
  return items.map((item) => {
    if (item.stream !== null) return item;
    const coefficient = AUTO_ITEM_COEFFICIENTS[item.slug];
    if (coefficient === undefined) return item;
    return { ...item, total: eligible(item.slug) ? Math.round(studentCount * coefficient) : 0 };
  });
}

export function sumStudents(
  groupIds: ReadonlyArray<string>,
  groups: ReadonlyArray<{ id: string; studentNumber: number | null }>,
): number {
  const byId = new Map(groups.map((g) => [g.id, g.studentNumber ?? 0]));
  return groupIds.reduce((sum, id) => sum + (byId.get(id) ?? 0), 0);
}
