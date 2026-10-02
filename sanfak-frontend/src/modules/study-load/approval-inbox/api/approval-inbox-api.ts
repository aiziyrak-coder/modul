import { useQuery } from '@tanstack/react-query';
import { fetchList, getApiErrorMessage } from '@/shared/api';
import { mapApprovalInboxItem, type BackendApprovalInboxItem } from './mapper';
import type { ApprovalInboxEntity } from '../model/types';

export const APPROVAL_INBOX_KEY = 'approvalInbox';
const ROOT = '/approval-inbox';

export function useApprovalInbox(entity?: ApprovalInboxEntity) {
  return useQuery({
    queryKey: [APPROVAL_INBOX_KEY, entity ?? 'all'],
    queryFn: async () => {
      const docs = await fetchList<BackendApprovalInboxItem>(
        ROOT,
        entity ? { entity } : undefined,
      );
      return docs.map(mapApprovalInboxItem);
    },
    staleTime: 0,
    gcTime: 0,
  });
}

export { getApiErrorMessage };
