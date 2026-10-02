import {
  CONTINGENT_NUM_FIELDS,
  type ContingentNumbers,
  type ContingentRow,
  type ForeignRow,
} from './types';

export type RowErrorKey =
  | 'studyLoad.contingentReport.invariant.gender'
  | 'studyLoad.contingentReport.invariant.funding'
  | 'studyLoad.contingentReport.invariant.grantGender'
  | 'studyLoad.contingentReport.invariant.contractGender';

export function rowErrors(r: ContingentNumbers): RowErrorKey[] {
  const errors: RowErrorKey[] = [];
  if (r.boys + r.girls !== r.total) errors.push('studyLoad.contingentReport.invariant.gender');
  if (r.grant + r.contract !== r.total) errors.push('studyLoad.contingentReport.invariant.funding');
  if (r.grantBoys + r.grantGirls !== r.grant) errors.push('studyLoad.contingentReport.invariant.grantGender');
  if (r.contractBoys + r.contractGirls !== r.contract) {
    errors.push('studyLoad.contingentReport.invariant.contractGender');
  }
  return errors;
}

export function foreignRowError(r: ForeignRow): 'studyLoad.contingentReport.invariant.gender' | null {
  return r.boys + r.girls !== r.total ? 'studyLoad.contingentReport.invariant.gender' : null;
}

export function invalidRowCount(rows: ContingentNumbers[], foreign: ForeignRow[]): number {
  return (
    rows.filter((r) => rowErrors(r).length > 0).length +
    foreign.filter((f) => foreignRowError(f) !== null).length
  );
}

export function zeroNumbers(): ContingentNumbers {
  return Object.fromEntries(CONTINGENT_NUM_FIELDS.map((f) => [f, 0])) as ContingentNumbers;
}

export function sumNumbers(rows: ContingentNumbers[]): ContingentNumbers {
  const acc = zeroNumbers();
  for (const r of rows) for (const f of CONTINGENT_NUM_FIELDS) acc[f] += r[f];
  return acc;
}

export const blockKey = (r: Pick<ContingentRow, 'directionId' | 'category'>) =>
  `${r.directionId}|${r.category}`;

export const rowKey = (r: Pick<ContingentRow, 'directionId' | 'category' | 'course'>) =>
  `${r.directionId}|${r.category}|${r.course}`;

export interface DirectionBlock {
  key: string;
  directionId: string;
  directionCode: string;
  directionTitle: string;
  category: ContingentRow['category'];
  rows: ContingentRow[];
  total: ContingentNumbers;
}

export function groupRows(rows: ContingentRow[]): DirectionBlock[] {
  const blocks = new Map<string, DirectionBlock>();
  for (const r of rows) {
    const key = blockKey(r);
    let b = blocks.get(key);
    if (!b) {
      b = {
        key,
        directionId: r.directionId,
        directionCode: r.directionCode,
        directionTitle: r.directionTitle,
        category: r.category,
        rows: [],
        total: zeroNumbers(),
      };
      blocks.set(key, b);
    }
    b.rows.push(r);
  }
  return [...blocks.values()].map((b) => {
    const sorted = [...b.rows].sort((a, c) => a.course - c.course);
    return { ...b, rows: sorted, total: sumNumbers(sorted) };
  });
}

export function hasDuplicateRow(rows: ContingentRow[], candidate: Pick<ContingentRow, 'directionId' | 'category' | 'course'>): boolean {
  const key = rowKey(candidate);
  return rows.some((r) => rowKey(r) === key);
}
