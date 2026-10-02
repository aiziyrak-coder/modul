import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchOne, fetchPaginated, postJson, putJson } from '@/shared/api';
import { noClientRetry } from './expulsion-order-api';
import type { Paged } from './residency-api';
import {
  mapGrid,
  mapOutage,
  mapOverview,
  mapWarnings,
  type BackendSamsDays,
  type BackendSamsOutage,
  type BackendSamsOverview,
  type BackendSamsWarnings,
} from './sams-status-mapper';
import type {
  SamsDay,
  SamsGrid,
  SamsOutage,
  SamsOutageDraft,
  SamsOutageStatusFilter,
  SamsOverview,
  SamsWarnings,
} from './sams-status-types';
import { toCreateOutagePayload } from '../lib/sams-outage-draft';

const ROOT_STATUS = '/residency-sams-status';
const ROOT_OUTAGE = '/residency-sams-outages';
export const SAMS_QUERY_KEY = 'residency-sams';

const POLL_MS = 60_000;
const WARNINGS_STALE_MS = 5 * 60_000;

export async function fetchSamsOverview(): Promise<SamsOverview> {
  return mapOverview(await fetchOne<BackendSamsOverview>(`${ROOT_STATUS}/overview`));
}

export function useSamsOverview() {
  return useQuery({
    queryKey: [SAMS_QUERY_KEY, 'overview'],
    queryFn: fetchSamsOverview,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
    retry: noClientRetry,
  });
}

export interface SamsWindow {
  from: SamsDay;
  to: SamsDay;
}

export async function fetchSamsGrid(range: SamsWindow): Promise<SamsGrid> {
  const raw = await fetchOne<BackendSamsDays>(`${ROOT_STATUS}/days`, {
    from: range.from,
    to: range.to,
  });
  return mapGrid(raw, range);
}

export function useSamsGrid(range: SamsWindow | null) {
  return useQuery({
    queryKey: [SAMS_QUERY_KEY, 'days', range?.from ?? null, range?.to ?? null],
    enabled: range !== null,
    queryFn: () => fetchSamsGrid(range as SamsWindow),
    placeholderData: keepPreviousData,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
    retry: noClientRetry,
  });
}

export async function fetchSamsWarnings(): Promise<SamsWarnings> {
  return mapWarnings(await fetchOne<BackendSamsWarnings>(`${ROOT_STATUS}/warnings`));
}

export function useSamsWarnings(enabled = true) {
  return useQuery({
    queryKey: [SAMS_QUERY_KEY, 'warnings'],
    enabled,
    queryFn: fetchSamsWarnings,
    staleTime: WARNINGS_STALE_MS,
    retry: noClientRetry,
  });
}

export interface SamsOutageListParams {
  page: number;
  limit: number;
  status: SamsOutageStatusFilter;
  from?: SamsDay;
  to?: SamsDay;
}

function outageQuery(p: SamsOutageListParams): {
  page: number;
  limit: number;
  [key: string]: unknown;
} {
  const query: { page: number; limit: number; [key: string]: unknown } = {
    page: p.page,
    limit: p.limit,
    status: p.status,
  };
  if (p.from) query.from = p.from;
  if (p.to) query.to = p.to;
  return query;
}

export interface SamsOutagePage extends Paged<SamsOutage> {
  hasNextPage: boolean;
}

export async function fetchSamsOutages(params: SamsOutageListParams): Promise<SamsOutagePage> {
  const res = await fetchPaginated<BackendSamsOutage>(
    `${ROOT_OUTAGE}/paginate`,
    outageQuery(params),
  );
  return {
    items: (res.docs ?? []).map(mapOutage),
    total: res.totalDocs ?? 0,
    page: res.page ?? params.page,
    totalPages: res.totalPages ?? 1,
    hasNextPage: res.hasNextPage === true,
  };
}

export interface SamsOutageQueryOptions {
  enabled?: boolean;
  poll?: boolean;
}

export function useSamsOutages(
  params: SamsOutageListParams,
  { enabled = true, poll = false }: SamsOutageQueryOptions = {},
) {
  return useQuery({
    queryKey: [SAMS_QUERY_KEY, 'outages', params],
    enabled,
    queryFn: () => fetchSamsOutages(params),
    placeholderData: keepPreviousData,
    refetchInterval: poll ? POLL_MS : false,
    refetchIntervalInBackground: false,
    retry: noClientRetry,
  });
}

export function useCreateSamsOutage() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: async (draft: SamsOutageDraft): Promise<SamsOutage> =>
      mapOutage(await postJson<BackendSamsOutage>(ROOT_OUTAGE, toCreateOutagePayload(draft))),
    onSuccess: () => q.invalidateQueries({ queryKey: [SAMS_QUERY_KEY] }),
  });
}

export function useCancelSamsOutage() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }): Promise<SamsOutage> =>
      mapOutage(
        await putJson<BackendSamsOutage>(`${ROOT_OUTAGE}/${id}/cancel`, { reason: reason.trim() }),
      ),
    onSettled: () => q.invalidateQueries({ queryKey: [SAMS_QUERY_KEY] }),
  });
}
