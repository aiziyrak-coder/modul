import type { WorkItem } from './types';

type EvidenceItem = Pick<WorkItem, 'status' | 'verification'>;

export function isEvidenceResubmit(item: EvidenceItem): boolean {
  return item.status === 'completed' && item.verification?.status === 'rejected';
}

export function canSubmitEvidence(item: EvidenceItem): boolean {
  return item.status !== 'completed' || isEvidenceResubmit(item);
}
