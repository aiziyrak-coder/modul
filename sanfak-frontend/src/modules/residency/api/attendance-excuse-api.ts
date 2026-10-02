import { useQueryClient } from '@tanstack/react-query';
import { useApproveExcuse } from './residency-api';
import { SESSION_KEY } from './session-api';
import { EXPULSION_ORDER_KEY } from './expulsion-order-api';
import { NOTICE_KEY } from './notice-api';

export const EXCUSE_REASON = { min: 2, max: 500 } as const;

export function useExcuseAbsence() {
  const q = useQueryClient();
  return useApproveExcuse({
    onSettled: () => {
      void q.invalidateQueries({ queryKey: [SESSION_KEY] });
      void q.invalidateQueries({ queryKey: [EXPULSION_ORDER_KEY] });
      void q.invalidateQueries({ queryKey: [NOTICE_KEY, 'absence-streak'] });
    },
  });
}
