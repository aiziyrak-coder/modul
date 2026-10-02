import type { ForeignStatus } from './types';

export const STATUS_META: Record<ForeignStatus, { color: string; titleKey: string }> = {
  yangi: { color: 'blue', titleKey: 'foreignAdmission.status.yangi' },
  tasdiqlangan: { color: 'green', titleKey: 'foreignAdmission.status.tasdiqlangan' },
  radEtilgan: { color: 'red', titleKey: 'foreignAdmission.status.radEtilgan' },
};

export const STATUS_ORDER: ForeignStatus[] = ['yangi', 'tasdiqlangan', 'radEtilgan'];

const BY_BACKEND: Readonly<Record<string, ForeignStatus>> = {
  new: 'yangi',
  approved: 'tasdiqlangan',
  rejected: 'radEtilgan',
};

export function toForeignStatus(raw: string | undefined): ForeignStatus {
  return (raw && BY_BACKEND[raw]) || 'yangi';
}

export function isActionable(status: ForeignStatus): boolean {
  return status === 'yangi';
}
