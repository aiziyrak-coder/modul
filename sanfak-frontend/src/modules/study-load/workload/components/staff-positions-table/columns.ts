import type { StaffPositionItem } from '../../model/detail-types';
import type { StaffPositionEditItem } from '../../api/workload-api';

export type StaffCategory = 'departmentHead' | 'teachingStaff' | 'supportStaff';

export interface StaffLeafCol {
  slug: string;
  labelKey: string;
}

export interface StaffGroupDef {
  category: StaffCategory;
  labelKey: string;
  cols: StaffLeafCol[];
  hasTotal: boolean;
  totalLabelKey?: string;
  totalOf?: StaffCategory[];
  totalRows?: StaffRowKey[];
}

export const STAFF_GROUPS: StaffGroupDef[] = [
  {
    category: 'departmentHead',
    labelKey: 'studyLoad.workload.staff.group.departmentHead',
    hasTotal: false,
    cols: [
      { slug: 'professor', labelKey: 'studyLoad.workload.staff.slug.professor' },
      { slug: 'docent', labelKey: 'studyLoad.workload.staff.slug.docent' },
      { slug: 'seniorTeacher', labelKey: 'studyLoad.workload.staff.slug.seniorTeacher' },
    ],
  },
  {
    category: 'teachingStaff',
    labelKey: 'studyLoad.workload.staff.group.teachingStaff',
    hasTotal: true,
    totalLabelKey: 'studyLoad.workload.staff.totalTeaching',
    totalOf: ['departmentHead', 'teachingStaff'],
    cols: [
      { slug: 'professor', labelKey: 'studyLoad.workload.staff.slug.professor' },
      { slug: 'docent', labelKey: 'studyLoad.workload.staff.slug.docent' },
      { slug: 'seniorTeacher', labelKey: 'studyLoad.workload.staff.slug.seniorTeacher' },
      { slug: 'assistant', labelKey: 'studyLoad.workload.staff.slug.assistant' },
      { slug: 'trainee', labelKey: 'studyLoad.workload.staff.slug.trainee' },
    ],
  },
  {
    category: 'supportStaff',
    labelKey: 'studyLoad.workload.staff.group.supportStaff',
    hasTotal: true,
    totalLabelKey: 'studyLoad.workload.staff.totalSupport',
    totalOf: ['departmentHead', 'teachingStaff', 'supportStaff'],
    totalRows: ['positions'],
    cols: [
      { slug: 'seniorLaborant', labelKey: 'studyLoad.workload.staff.slug.seniorLaborant' },
      { slug: 'laborant', labelKey: 'studyLoad.workload.staff.slug.laborant' },
      { slug: 'cabinetHead', labelKey: 'studyLoad.workload.staff.slug.cabinetHead' },
    ],
  },
];

export const STAFF_TABLE_MIN_WIDTH = 960;

export type StaffRowKey = 'positions' | 'load' | 'totalHours' | 'hourly';

export const STAFF_ROWS: { key: StaffRowKey; labelKey: string; editable: boolean }[] = [
  { key: 'positions', labelKey: 'studyLoad.workload.staff.row.positions', editable: true },
  { key: 'load', labelKey: 'studyLoad.workload.staff.row.load', editable: true },
  { key: 'totalHours', labelKey: 'studyLoad.workload.staff.row.totalHours', editable: false },
  { key: 'hourly', labelKey: 'studyLoad.workload.staff.row.hourly', editable: true },
];

export type StaffEditableField = 'positions' | 'load' | 'hourly';

export function itemKey(category: string, slug: string): string {
  return `${category}:${slug}`;
}

export function findStaffItem(
  items: StaffPositionItem[],
  category: string,
  slug: string,
): StaffPositionItem | undefined {
  return items.find((it) => it.category === category && it.slug === slug);
}

export type StaffDraftMap = Record<string, { positions: number; load: number; hourly: number }>;

export function staffCellValue(
  items: StaffPositionItem[],
  drafts: StaffDraftMap,
  category: string,
  slug: string,
  field: StaffEditableField,
): number {
  const draft = drafts[itemKey(category, slug)];
  if (draft) return draft[field];
  return findStaffItem(items, category, slug)?.[field] ?? 0;
}

export function averageLoad(totalHours: number, positions: number): number {
  if (!(positions > 0)) return 0;
  return Math.round(totalHours / positions);
}

export function sumStaffGroup(
  items: StaffPositionItem[],
  drafts: StaffDraftMap,
  group: StaffGroupDef,
  field: StaffRowKey,
): number {
  if (group.totalRows && !group.totalRows.includes(field)) return 0;
  const groups = group.totalOf
    ? STAFF_GROUPS.filter((g) => group.totalOf!.includes(g.category))
    : [group];
  let positionsSum = 0;
  let totalHoursSum = 0;
  let hourlySum = 0;
  for (const g of groups) {
    for (const col of g.cols) {
      const positions = staffCellValue(items, drafts, g.category, col.slug, 'positions');
      const load = staffCellValue(items, drafts, g.category, col.slug, 'load');
      positionsSum += positions;
      totalHoursSum += positions * load;
      hourlySum += staffCellValue(items, drafts, g.category, col.slug, 'hourly');
    }
  }
  if (field === 'positions') return positionsSum;
  if (field === 'load') return averageLoad(totalHoursSum, positionsSum);
  if (field === 'hourly') return hourlySum;
  return totalHoursSum;
}

export function buildStaffPositionsPayload(
  items: StaffPositionItem[],
  drafts: StaffDraftMap,
): StaffPositionEditItem[] {
  const payload: StaffPositionEditItem[] = [];
  for (const group of STAFF_GROUPS) {
    for (const col of group.cols) {
      const existing = findStaffItem(items, group.category, col.slug);
      payload.push({
        ...(existing?.id ? { id: existing.id } : {}),
        category: group.category,
        slug: col.slug,
        positions: staffCellValue(items, drafts, group.category, col.slug, 'positions'),
        load: staffCellValue(items, drafts, group.category, col.slug, 'load'),
        hourly: staffCellValue(items, drafts, group.category, col.slug, 'hourly'),
      });
    }
  }
  return payload;
}
