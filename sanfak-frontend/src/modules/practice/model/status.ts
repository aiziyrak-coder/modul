import type { Contract, ContractStatus, PracticeRole } from './types';

export const STATUS_META: Record<ContractStatus, { label: string; color: string }> = {
  draft: { label: 'Yangi', color: 'blue' },
  in_progress: { label: 'Jarayonda', color: 'gold' },
  rektor_approved: { label: 'Rektor tasdiqlagan', color: 'cyan' },
  both_approved: { label: 'Ikki tomon tasdiqlagan', color: 'green' },
  rejected: { label: 'Rad etilgan', color: 'red' },
};

export const STATUS_ORDER: ContractStatus[] = [
  'draft',
  'in_progress',
  'rektor_approved',
  'both_approved',
  'rejected',
];

export function statusLabelForRole(status: ContractStatus, role: PracticeRole): string {
  if (role === 'rektor' && status === 'rektor_approved') return 'Tasdiqlagan';
  return STATUS_META[status].label;
}

export interface TabDef {
  key: string;
  label: string;
  statuses: ContractStatus[] | null;
  archive?: boolean;
}

const DEPT_TABS: TabDef[] = [
  { key: 'all', label: 'Barchasi', statuses: null },
  { key: 'draft', label: 'Yangi', statuses: ['draft'] },
  { key: 'in_progress', label: 'Jarayonda', statuses: ['in_progress'] },
  { key: 'rektor_approved', label: 'Rektor tasdiqlagan', statuses: ['rektor_approved'] },
  { key: 'both_approved', label: 'Ikki tomon tasdiqlagan', statuses: ['both_approved'] },
  { key: 'rejected', label: 'Rad etilgan', statuses: ['rejected'] },
  { key: 'archive', label: 'Arxiv', statuses: ['both_approved'], archive: true },
];

const reviewerTabs = (
  pendingStatus: ContractStatus,
  signedStatuses: ContractStatus[],
): TabDef[] => [
  { key: 'all', label: 'Barchasi', statuses: null },
  { key: 'new', label: 'Yangi', statuses: [pendingStatus] },
  { key: 'approved', label: 'Tasdiqlangan', statuses: signedStatuses },
  { key: 'rejected', label: 'Rad etilgan', statuses: ['rejected'] },
  { key: 'archive', label: 'Arxiv', statuses: ['both_approved'], archive: true },
];

export function tabsForRole(role: PracticeRole): TabDef[] {
  if (role === 'rektor') return reviewerTabs('in_progress', ['rektor_approved', 'both_approved']);
  if (role === 'tibbiyot_birlashmasi_rahbari') return reviewerTabs('rektor_approved', ['both_approved']);
  return DEPT_TABS;
}

export function visibleStatusesForRole(role: PracticeRole): ContractStatus[] | null {
  if (role === 'rektor')
    return ['in_progress', 'rektor_approved', 'both_approved', 'rejected'];
  if (role === 'tibbiyot_birlashmasi_rahbari')
    return ['rektor_approved', 'both_approved', 'rejected'];
  return null;
}

export function matchesTab(contract: Contract, tab: TabDef): boolean {
  if (tab.statuses === null) return true;
  return tab.statuses.includes(contract.status);
}

export const isEditable = (status: ContractStatus): boolean =>
  status === 'draft' || status === 'rejected';
