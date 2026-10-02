import type { WorkloadRow } from '../../model/detail-types';
import type { UpdateBlockPayload } from '../../model/detail-types';

export type EditableColKey =
  | 'lectStr'
  | 'clinStr'
  | 'semStr'
  | 'labStr'
  | 'pratStr'
  | 'on'
  | 'yan'
  | 'missed'
  | 'skilled'
  | 'vada'
  | 'reception'
  | 'consulting'
  | 'openDep'
  | 'integral'
  | 'special'
  | 'leadership';

type MergeTarget = 'classTypes' | 'studyItems' | 'otherItems' | 'leadership';

const MERGE_TARGET: Record<EditableColKey, MergeTarget> = {
  lectStr: 'classTypes',
  clinStr: 'classTypes',
  semStr: 'classTypes',
  labStr: 'classTypes',
  pratStr: 'classTypes',
  on: 'studyItems',
  yan: 'studyItems',
  missed: 'studyItems',
  skilled: 'studyItems',
  vada: 'otherItems',
  reception: 'otherItems',
  consulting: 'otherItems',
  openDep: 'otherItems',
  integral: 'otherItems',
  special: 'otherItems',
  leadership: 'leadership',
};

export type WorkloadColKey =
  | 'science'
  | 'course'
  | 'student'
  | 'group'
  | 'perGroup'
  | 'streamCount'
  | 'semester'
  | 'semTotal'
  | 'semAud'
  | EditableColKey
  | 'lectTot'
  | 'clinTot'
  | 'semTot'
  | 'labTot'
  | 'pratTot'
  | 'total';

export type WorkloadColGroup = 'info' | 'studyWork' | 'otherWork' | 'total';

export interface WorkloadColumnDef {
  key: WorkloadColKey;
  labelKey: string;
  group: WorkloadColGroup;
  width: number;
  editable: boolean;
}

const INFO_COLS: WorkloadColumnDef[] = [
  { key: 'science', labelKey: 'studyLoad.workload.col.science', group: 'info', width: 200, editable: false },
  { key: 'course', labelKey: 'studyLoad.workload.col.course', group: 'info', width: 60, editable: false },
  { key: 'student', labelKey: 'studyLoad.workload.col.student', group: 'info', width: 80, editable: false },
  { key: 'group', labelKey: 'studyLoad.workload.col.group', group: 'info', width: 70, editable: false },
  { key: 'perGroup', labelKey: 'studyLoad.workload.col.perGroup', group: 'info', width: 90, editable: false },
  { key: 'streamCount', labelKey: 'studyLoad.workload.col.streamCount', group: 'info', width: 90, editable: false },
  { key: 'semester', labelKey: 'studyLoad.workload.col.semester', group: 'info', width: 70, editable: false },
];

const STUDY_WORK_COLS: WorkloadColumnDef[] = [
  { key: 'semTotal', labelKey: 'studyLoad.workload.col.semTotal', group: 'studyWork', width: 90, editable: false },
  { key: 'semAud', labelKey: 'studyLoad.workload.col.semAud', group: 'studyWork', width: 90, editable: false },
  { key: 'lectStr', labelKey: 'studyLoad.workload.col.lectStr', group: 'studyWork', width: 110, editable: true },
  { key: 'lectTot', labelKey: 'studyLoad.workload.col.lectTot', group: 'studyWork', width: 90, editable: false },
  { key: 'clinStr', labelKey: 'studyLoad.workload.col.clinStr', group: 'studyWork', width: 130, editable: true },
  { key: 'clinTot', labelKey: 'studyLoad.workload.col.clinTot', group: 'studyWork', width: 100, editable: false },
  { key: 'semStr', labelKey: 'studyLoad.workload.col.semStr', group: 'studyWork', width: 110, editable: true },
  { key: 'semTot', labelKey: 'studyLoad.workload.col.semTot', group: 'studyWork', width: 100, editable: false },
  { key: 'labStr', labelKey: 'studyLoad.workload.col.labStr', group: 'studyWork', width: 110, editable: true },
  { key: 'labTot', labelKey: 'studyLoad.workload.col.labTot', group: 'studyWork', width: 100, editable: false },
  { key: 'pratStr', labelKey: 'studyLoad.workload.col.pratStr', group: 'studyWork', width: 130, editable: true },
  { key: 'pratTot', labelKey: 'studyLoad.workload.col.pratTot', group: 'studyWork', width: 110, editable: false },
  { key: 'on', labelKey: 'studyLoad.workload.col.on', group: 'studyWork', width: 130, editable: true },
  { key: 'yan', labelKey: 'studyLoad.workload.col.yan', group: 'studyWork', width: 130, editable: true },
  { key: 'missed', labelKey: 'studyLoad.workload.col.missed', group: 'studyWork', width: 160, editable: true },
  { key: 'skilled', labelKey: 'studyLoad.workload.col.skilled', group: 'studyWork', width: 160, editable: true },
  { key: 'vada', labelKey: 'studyLoad.workload.col.vada', group: 'studyWork', width: 110, editable: true },
  { key: 'reception', labelKey: 'studyLoad.workload.col.reception', group: 'studyWork', width: 90, editable: true },
  { key: 'consulting', labelKey: 'studyLoad.workload.col.consulting', group: 'studyWork', width: 150, editable: true },
  { key: 'openDep', labelKey: 'studyLoad.workload.col.openDep', group: 'studyWork', width: 130, editable: true },
  { key: 'integral', labelKey: 'studyLoad.workload.col.integral', group: 'studyWork', width: 100, editable: true },
];

const OTHER_WORK_COLS: WorkloadColumnDef[] = [
  { key: 'special', labelKey: 'studyLoad.workload.col.special', group: 'otherWork', width: 170, editable: true },
  { key: 'leadership', labelKey: 'studyLoad.workload.col.leadership', group: 'otherWork', width: 150, editable: true },
];

const TOTAL_COLS: WorkloadColumnDef[] = [
  { key: 'total', labelKey: 'studyLoad.workload.col.total', group: 'total', width: 100, editable: false },
];

export const WORKLOAD_COLUMNS: WorkloadColumnDef[] = [
  ...INFO_COLS,
  ...STUDY_WORK_COLS,
  ...OTHER_WORK_COLS,
  ...TOTAL_COLS,
];

export const WORKLOAD_TABLE_MIN_WIDTH = WORKLOAD_COLUMNS.reduce((sum, c) => sum + c.width, 0);

export const EDITABLE_COLUMNS = WORKLOAD_COLUMNS.filter((c) => c.editable);

export function buildUpdateBlockPayload(
  row: WorkloadRow,
  draft: Partial<Record<EditableColKey, number>>,
): UpdateBlockPayload | null {
  const classTypes: { _id: string; stream: number }[] = [];
  const studyItems: { _id: string; value: number }[] = [];
  const otherItems: { _id: string; value: number }[] = [];
  let leadership: number | undefined;

  for (const key of Object.keys(draft) as EditableColKey[]) {
    const value = draft[key];
    if (value === undefined) continue;
    const target = MERGE_TARGET[key];

    if (target === 'leadership') {
      leadership = value;
      continue;
    }

    const entryId = row[key].entryId;
    if (!entryId) continue;

    if (target === 'classTypes') classTypes.push({ _id: entryId, stream: value });
    else if (target === 'studyItems') studyItems.push({ _id: entryId, value });
    else if (target === 'otherItems') otherItems.push({ _id: entryId, value });
  }

  const payload: UpdateBlockPayload = {};
  if (classTypes.length > 0 || studyItems.length > 0) {
    payload.studyWork = {};
    if (classTypes.length > 0) payload.studyWork.classTypes = classTypes;
    if (studyItems.length > 0) payload.studyWork.items = studyItems;
  }
  if (otherItems.length > 0) payload.otherWork = { items: otherItems };
  if (leadership !== undefined) payload.leadership = leadership;

  const isEmpty = !payload.studyWork && !payload.otherWork && payload.leadership === undefined;
  return isEmpty ? null : payload;
}

const EDITABLE_KEY_SET = new Set<string>(EDITABLE_COLUMNS.map((c) => c.key));

function isEditableColKey(key: WorkloadColKey): key is EditableColKey {
  return EDITABLE_KEY_SET.has(key);
}

export function flattenWorkloadRow(row: WorkloadRow): Record<WorkloadColKey, number | string> {
  return {
    science: row.science,
    course: row.course,
    student: row.student,
    group: row.group,
    perGroup: row.perGroup,
    streamCount: row.streamCount,
    semester: row.semester,
    semTotal: row.semTotal,
    semAud: row.semAud,
    lectStr: row.lectStr.value,
    lectTot: row.lectTot,
    clinStr: row.clinStr.value,
    clinTot: row.clinTot,
    semStr: row.semStr.value,
    semTot: row.semTot,
    labStr: row.labStr.value,
    pratStr: row.pratStr.value,
    labTot: row.labTot,
    pratTot: row.pratTot,
    on: row.on.value,
    yan: row.yan.value,
    missed: row.missed.value,
    skilled: row.skilled.value,
    vada: row.vada.value,
    reception: row.reception.value,
    consulting: row.consulting.value,
    openDep: row.openDep.value,
    integral: row.integral.value,
    special: row.special.value,
    leadership: row.leadership.value,
    total: row.total,
  };
}

export function sumWorkloadRows(rows: WorkloadRow[]): Partial<Record<WorkloadColKey, number>> {
  const sumCols = WORKLOAD_COLUMNS.filter((c) => c.group !== 'info');
  const sums: Partial<Record<WorkloadColKey, number>> = {};
  for (const col of sumCols) sums[col.key] = 0;
  for (const row of rows) {
    const flat = flattenWorkloadRow(row);
    for (const col of sumCols) {
      const v = flat[col.key];
      sums[col.key] = (sums[col.key] ?? 0) + (typeof v === 'number' ? v : 0);
    }
  }
  return sums;
}

export function groupRowsBySection(rows: WorkloadRow[]): { section: string; rows: WorkloadRow[] }[] {
  const groups: { section: string; rows: WorkloadRow[] }[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.section === row.section) last.rows.push(row);
    else groups.push({ section: row.section, rows: [row] });
  }
  return groups;
}

export function groupRowsByDirection(rows: WorkloadRow[]): { direction: string; rows: WorkloadRow[] }[] {
  const groups: { direction: string; rows: WorkloadRow[] }[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.direction === row.direction) last.rows.push(row);
    else groups.push({ direction: row.direction, rows: [row] });
  }
  return groups;
}

export { isEditableColKey, INFO_COLS, STUDY_WORK_COLS, OTHER_WORK_COLS, TOTAL_COLS };
