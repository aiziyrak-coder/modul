import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { apiClient, fetchOne, fetchPaginated, putJson, uploadMultipart } from '@/shared/api';
import { RES_KEY, type Paged } from './residency-api';
import {
  draftFallbackName,
  mapExpulsionOrder,
  type BackendExpulsionOrder,
  type SignPayload,
} from './expulsion-order-mapper';
import type {
  ExpulsionOrder,
  ExpulsionOrderOrigin,
  ExpulsionOrderStatus,
} from './expulsion-order-types';
import { saveBlob } from '../lib/blob-file';

const ROOT = '/expulsion-orders';
export const EXPULSION_ORDER_KEY = 'residency-expulsion-orders';

export interface ExpulsionOrderListParams {
  page: number;
  limit: number;
  status?: ExpulsionOrderStatus;
  origin?: ExpulsionOrderOrigin;
  resident?: string;
}

export function noClientRetry(failureCount: number, error: unknown): boolean {
  const status = error instanceof AxiosError ? error.response?.status : undefined;
  return failureCount < 1 && (status === undefined || status >= 500);
}

function listQuery(params: ExpulsionOrderListParams): { page: number; limit: number; [key: string]: unknown } {
  const query: { page: number; limit: number; [key: string]: unknown } = {
    page: params.page,
    limit: params.limit,
  };
  if (params.status) query.status = params.status;
  if (params.origin) query.origin = params.origin;
  if (params.resident) query.resident = params.resident;
  return query;
}

export async function fetchExpulsionOrders(params: ExpulsionOrderListParams): Promise<Paged<ExpulsionOrder>> {
  const res = await fetchPaginated<BackendExpulsionOrder>(`${ROOT}/paginate`, listQuery(params));
  return {
    items: (res.docs ?? []).map(mapExpulsionOrder),
    total: res.totalDocs ?? 0,
    page: res.page ?? params.page,
    totalPages: res.totalPages ?? 1,
  };
}

export function useExpulsionOrders(params: ExpulsionOrderListParams) {
  return useQuery({
    queryKey: [EXPULSION_ORDER_KEY, 'paginate', params],
    placeholderData: keepPreviousData,
    retry: noClientRetry,
    queryFn: () => fetchExpulsionOrders(params),
  });
}

export async function fetchExpulsionOrder(id: string): Promise<ExpulsionOrder> {
  return mapExpulsionOrder(await fetchOne<BackendExpulsionOrder>(`${ROOT}/${id}`));
}

export function useExpulsionOrder(id: string | undefined) {
  return useQuery({
    queryKey: [EXPULSION_ORDER_KEY, 'detail', id],
    enabled: !!id,
    retry: noClientRetry,
    queryFn: () => fetchExpulsionOrder(id as string),
  });
}

export function useUploadExpulsionScan() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) =>
      mapExpulsionOrder(await uploadMultipart<BackendExpulsionOrder>(`${ROOT}/${id}/scan`, 'PUT', { file })),
    onSuccess: (order) => {
      q.setQueryData([EXPULSION_ORDER_KEY, 'detail', order.id], order);
      void q.invalidateQueries({ queryKey: [EXPULSION_ORDER_KEY] });
    },
  });
}

export function useSignExpulsionOrder() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: SignPayload }) =>
      mapExpulsionOrder(await putJson<BackendExpulsionOrder>(`${ROOT}/${id}/sign`, payload)),
    onSettled: () => {
      void q.invalidateQueries({ queryKey: [EXPULSION_ORDER_KEY] });
      void q.invalidateQueries({ queryKey: [RES_KEY] });
    },
  });
}

export function useRejectExpulsionOrder() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      mapExpulsionOrder(
        await putJson<BackendExpulsionOrder>(`${ROOT}/${id}/reject`, { orderId: id, reason: reason.trim() }),
      ),
    onSettled: () => {
      void q.invalidateQueries({ queryKey: [EXPULSION_ORDER_KEY] });
    },
  });
}

async function fetchBlob(url: string): Promise<Blob> {
  const res = await apiClient.get<Blob>(url, { responseType: 'blob' });
  return res.data;
}

async function freshDraftName(id: string): Promise<string | null> {
  try {
    return (await fetchExpulsionOrder(id)).draftPdf?.fileName ?? null;
  } catch {
    return null;
  }
}

export async function downloadExpulsionDraftPdf(order: ExpulsionOrder): Promise<void> {
  const blob = await fetchBlob(`${ROOT}/${order.id}/draft-pdf`);
  const name =
    order.draftPdf?.fileName ?? (await freshDraftName(order.id)) ?? draftFallbackName(order.id);
  saveBlob(blob, name);
}

export async function downloadExpulsionScan(order: ExpulsionOrder): Promise<void> {
  const blob = await fetchBlob(`${ROOT}/${order.id}/scan`);
  saveBlob(blob, order.scan?.fileName ?? 'buyruq-skan');
}
