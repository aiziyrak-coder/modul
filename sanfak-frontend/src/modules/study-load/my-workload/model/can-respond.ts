import type { MyWorkloadRow } from './types';

type RespondRow = Pick<MyWorkloadRow, 'acceptanceStatus' | 'distributionStatus' | 'blockId'> &
  Partial<Pick<MyWorkloadRow, 'superseded'>>;

export function canRespondToWorkload(row: RespondRow): boolean {
  return (
    row.blockId !== null &&
    row.acceptanceStatus === 'pending' &&
    row.distributionStatus !== 'superseded' &&
    row.superseded !== true
  );
}

export function canRejectWorkload(row: RespondRow): boolean {
  return canRespondToWorkload(row) && row.distributionStatus !== 'approved';
}
