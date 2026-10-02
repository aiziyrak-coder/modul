import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { App } from '@/shared/ui';
import { EXPULSION_ORDER_KEY } from '../api/expulsion-order-api';
import { describeOrderError, needsRefetch, type OrderErrorInfo } from './order-error';

export function useOrderErrorReporter(): (err: unknown) => Promise<OrderErrorInfo> {
  const { message } = App.useApp();
  const q = useQueryClient();
  return useCallback(
    async (err: unknown) => {
      const info = await describeOrderError(err);
      message.error(info.message);
      if (needsRefetch(info)) {
        void q.invalidateQueries({ queryKey: [EXPULSION_ORDER_KEY] });
      }
      return info;
    },
    [message, q],
  );
}
