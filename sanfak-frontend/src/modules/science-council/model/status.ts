import type { StatusTagProps } from '@/shared/ui';
import type { WorkStatus } from './types';

type SharedStatus = StatusTagProps['status'];

export const STATUS_META: Record<WorkStatus, { sharedStatus: SharedStatus; titleKey: string }> = {
  new: { sharedStatus: 'info', titleKey: 'scienceCouncil.status.new' },
  accepted: { sharedStatus: 'pending', titleKey: 'scienceCouncil.status.accepted' },
  pending: { sharedStatus: 'pending', titleKey: 'scienceCouncil.status.pending' },
  reviewed: { sharedStatus: 'info', titleKey: 'scienceCouncil.status.reviewed' },
  not_evaluated: { sharedStatus: 'info', titleKey: 'scienceCouncil.status.not_evaluated' },
  not_recommended: { sharedStatus: 'rejected', titleKey: 'scienceCouncil.status.not_recommended' },
  rejected: { sharedStatus: 'rejected', titleKey: 'scienceCouncil.status.rejected' },
  revision: { sharedStatus: 'pending', titleKey: 'scienceCouncil.status.revision' },
};

export const STATUS_ORDER: WorkStatus[] = ['new', 'accepted', 'pending', 'reviewed', 'not_evaluated', 'not_recommended', 'rejected', 'revision'];
