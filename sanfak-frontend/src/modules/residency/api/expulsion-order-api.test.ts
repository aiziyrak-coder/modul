import { createElement, type ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  downloadExpulsionDraftPdf,
  downloadExpulsionScan,
  EXPULSION_ORDER_KEY,
  fetchExpulsionOrders,
  noClientRetry,
  useExpulsionOrder,
  useExpulsionOrders,
  useRejectExpulsionOrder,
  useSignExpulsionOrder,
  useUploadExpulsionScan,
} from './expulsion-order-api';
import { mapExpulsionOrder, type BackendExpulsionOrder, type SignPayload } from './expulsion-order-mapper';
import { RES_KEY } from './residency-api';

const h = vi.hoisted(() => ({
  fetchPaginated: vi.fn(),
  fetchOne: vi.fn(),
  putJson: vi.fn(),
  uploadMultipart: vi.fn(),
  apiGet: vi.fn(),
  saveBlob: vi.fn(),
}));

vi.mock('@/shared/api', () => ({
  apiClient: { get: h.apiGet },
  fetchPaginated: h.fetchPaginated,
  fetchOne: h.fetchOne,
  putJson: h.putJson,
  uploadMultipart: h.uploadMultipart,
  fetchList: vi.fn(),
  postJson: vi.fn(),
  patchJson: vi.fn(),
  deleteData: vi.fn(),
}));

vi.mock('../lib/blob-file', () => ({ saveBlob: h.saveBlob }));

const ID = '65f0000000000000000abc01';
const SHA = 'e'.repeat(64);
const DRAFT = { fileName: 'chetlatish-buyrugi-loyihasi-abc01-20260925.pdf', size: 2048, sha256: SHA };

const dto = (over: Partial<BackendExpulsionOrder> = {}): BackendExpulsionOrder => ({
  _id: ID,
  resident: { _id: 'r1', fullName: 'Aliyev Vali', status: 'oquvda', totalUnexcusedHours: 74 },
  origin: 'tizim',
  status: 'loyiha',
  ...over,
});

const httpError = (status: number) =>
  new AxiosError('xato', 'ERR', undefined, undefined, {
    status,
    statusText: '',
    data: {},
    headers: {} as AxiosHeaders,
    config: { headers: new AxiosHeaders() },
  });

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(qc, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
  return { qc, invalidate, wrapper };
}

const invalidatedKeys = (spy: ReturnType<typeof setup>['invalidate']) =>
  spy.mock.calls.map((c) => (c[0] as { queryKey: unknown[] }).queryKey);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchExpulsionOrders — ro‘yxat so‘rovi', () => {
  it('filtr yo‘q — FAQAT page/limit ketadi va sahifa shakliga o‘giriladi', async () => {
    h.fetchPaginated.mockResolvedValue({ docs: [dto()], totalDocs: 41, page: 2, totalPages: 3 });
    const res = await fetchExpulsionOrders({ page: 1, limit: 20 });

    expect(h.fetchPaginated).toHaveBeenCalledTimes(1);
    const [url, query] = h.fetchPaginated.mock.calls[0] as [string, Record<string, unknown>];
    expect(url).toBe('/expulsion-orders/paginate');
    expect(query).toEqual({ page: 1, limit: 20 });
    expect(Object.keys(query).sort()).toEqual(['limit', 'page']);
    expect(res).toEqual({ items: [mapExpulsionOrder(dto())], total: 41, page: 2, totalPages: 3 });
  });

  it('to‘ldirilgan filtrlar ketadi, bo‘sh `resident` tushib qoladi', async () => {
    h.fetchPaginated.mockResolvedValue({});
    const res = await fetchExpulsionOrders({ page: 2, limit: 20, status: 'imzolangan', origin: 'meros', resident: '' });
    expect(h.fetchPaginated.mock.calls[0]?.[1]).toEqual({ page: 2, limit: 20, status: 'imzolangan', origin: 'meros' });
    expect(res).toEqual({ items: [], total: 0, page: 2, totalPages: 1 });
  });

  it('`resident` berilsa — u ham ketadi', async () => {
    h.fetchPaginated.mockResolvedValue({ docs: [] });
    await fetchExpulsionOrders({ page: 1, limit: 100, resident: 'r1' });
    expect(h.fetchPaginated.mock.calls[0]?.[1]).toEqual({ page: 1, limit: 100, resident: 'r1' });
  });
});

describe('noClientRetry — faqat server/tarmoq xatosida bir marta', () => {
  it.each([
    [0, httpError(404), false],
    [0, httpError(403), false],
    [0, httpError(409), false],
    [0, httpError(500), true],
    [0, httpError(503), true],
    [0, new AxiosError('Network Error', 'ERR_NETWORK'), true],
    [0, new Error('boshqa'), true],
    [1, httpError(500), false],
    [1, new AxiosError('Network Error', 'ERR_NETWORK'), false],
  ])('failureCount=%i, %s → %s', (count, err, expected) => {
    expect(noClientRetry(count, err)).toBe(expected);
  });
});

describe('so‘rov hooklari', () => {
  it('useExpulsionOrders — kalit [KEY, "paginate", params] va xaritalangan sahifa', async () => {
    h.fetchPaginated.mockResolvedValue({ docs: [dto()], totalDocs: 1, page: 1, totalPages: 1 });
    const { qc, wrapper } = setup();
    const params = { page: 1, limit: 20, status: 'loyiha' as const };
    const { result } = renderHook(() => useExpulsionOrders(params), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items[0]?.id).toBe(ID);
    expect(qc.getQueryData([EXPULSION_ORDER_KEY, 'paginate', params])).toEqual(result.current.data);
  });

  it('useExpulsionOrder — GET /:id, kalit [KEY, "detail", id]', async () => {
    h.fetchOne.mockResolvedValue(dto());
    const { qc, wrapper } = setup();
    const { result } = renderHook(() => useExpulsionOrder(ID), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(h.fetchOne).toHaveBeenCalledWith(`/expulsion-orders/${ID}`);
    expect(qc.getQueryData([EXPULSION_ORDER_KEY, 'detail', ID])).toEqual(mapExpulsionOrder(dto()));
  });

  it('useExpulsionOrder(undefined) — so‘rov yuborilmaydi', () => {
    const { wrapper } = setup();
    renderHook(() => useExpulsionOrder(undefined), { wrapper });
    expect(h.fetchOne).not.toHaveBeenCalled();
  });

  it('404 — qayta so‘ralmaydi; 500 — bir marta qayta', async () => {
    const { wrapper } = setup();
    h.fetchOne.mockRejectedValue(httpError(404));
    const nf = renderHook(() => useExpulsionOrder('nf'), { wrapper });
    await waitFor(() => expect(nf.result.current.isError).toBe(true));
    expect(h.fetchOne).toHaveBeenCalledTimes(1);

    h.fetchOne.mockClear();
    h.fetchOne.mockRejectedValue(httpError(500));
    const boom = renderHook(() => useExpulsionOrder('boom'), { wrapper });
    await waitFor(() => expect(boom.result.current.isError).toBe(true));
    expect(h.fetchOne).toHaveBeenCalledTimes(2);
  });
});

describe('useUploadExpulsionScan', () => {
  it('PUT /:id/scan, tanada FAQAT `file`; javob keshga yoziladi va KEY yangilanadi', async () => {
    const scanned = dto({ scan: { fileName: 'skan.pdf', sha256: SHA, size: 10 } });
    h.uploadMultipart.mockResolvedValue(scanned);
    const { qc, invalidate, wrapper } = setup();
    const { result } = renderHook(() => useUploadExpulsionScan(), { wrapper });
    const file = new File(['%PDF-1.4'], 'skan.pdf', { type: 'application/pdf' });

    await result.current.mutateAsync({ id: ID, file });

    expect(h.uploadMultipart).toHaveBeenCalledTimes(1);
    const [url, method, fields] = h.uploadMultipart.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(url).toBe(`/expulsion-orders/${ID}/scan`);
    expect(method).toBe('PUT');
    expect(Object.keys(fields)).toEqual(['file']);
    expect(fields.file).toBe(file);
    expect(qc.getQueryData([EXPULSION_ORDER_KEY, 'detail', ID])).toEqual(mapExpulsionOrder(scanned));
    expect(invalidatedKeys(invalidate)).toContainEqual([EXPULSION_ORDER_KEY]);
  });
});

describe('useSignExpulsionOrder', () => {
  const payload: SignPayload = { orderId: ID, paperOrderNumber: '12-ch', paperOrderDate: '2026-09-25', scanSha256: SHA };

  it('PUT /:id/sign tana AYNAN; muvaffaqiyatda KEY VA RES_KEY yangilanadi', async () => {
    h.putJson.mockResolvedValue(dto({ status: 'imzolangan' }));
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useSignExpulsionOrder(), { wrapper });

    const order = await result.current.mutateAsync({ id: ID, payload });

    expect(order.status).toBe('imzolangan');
    expect(h.putJson).toHaveBeenCalledWith(`/expulsion-orders/${ID}/sign`, payload);
    expect(Object.keys(h.putJson.mock.calls[0]?.[1] as object).sort()).toEqual(
      ['orderId', 'paperOrderDate', 'paperOrderNumber', 'scanSha256'],
    );
    await waitFor(() => expect(invalidatedKeys(invalidate)).toEqual(expect.arrayContaining([[EXPULSION_ORDER_KEY], [RES_KEY]])));
  });

  it('XATODA ham KEY VA RES_KEY yangilanadi (S1 yozilib S2 yiqilgan)', async () => {
    h.putJson.mockRejectedValue(httpError(500));
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useSignExpulsionOrder(), { wrapper });

    await expect(result.current.mutateAsync({ id: ID, payload })).rejects.toBeInstanceOf(AxiosError);
    await waitFor(() => expect(invalidatedKeys(invalidate)).toEqual(expect.arrayContaining([[EXPULSION_ORDER_KEY], [RES_KEY]])));
  });
});

describe('useRejectExpulsionOrder', () => {
  it('PUT /:id/reject {orderId, trim qilingan sabab}; KEY yangilanadi', async () => {
    h.putJson.mockResolvedValue(dto({ status: 'rad_etilgan' }));
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useRejectExpulsionOrder(), { wrapper });

    await result.current.mutateAsync({ id: ID, reason: '  Hujjat to‘liq emas  ' });

    expect(h.putJson).toHaveBeenCalledWith(`/expulsion-orders/${ID}/reject`, {
      orderId: ID,
      reason: 'Hujjat to‘liq emas',
    });
    await waitFor(() => expect(invalidatedKeys(invalidate)).toContainEqual([EXPULSION_ORDER_KEY]));
  });

  it('xatoda ham KEY yangilanadi (poyga — holat server haqiqatidan)', async () => {
    h.putJson.mockRejectedValue(httpError(409));
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useRejectExpulsionOrder(), { wrapper });
    await expect(result.current.mutateAsync({ id: ID, reason: 'Sabab' })).rejects.toBeInstanceOf(AxiosError);
    await waitFor(() => expect(invalidatedKeys(invalidate)).toContainEqual([EXPULSION_ORDER_KEY]));
  });
});

describe('downloadExpulsionDraftPdf — nom DTO dan', () => {
  const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });

  beforeEach(() => {
    h.apiGet.mockResolvedValue({ data: blob });
  });

  it('DTO da nom bor — qayta GET yo‘q, `responseType: blob`', async () => {
    await downloadExpulsionDraftPdf(mapExpulsionOrder(dto({ draftPdf: DRAFT })));
    expect(h.apiGet).toHaveBeenCalledWith(`/expulsion-orders/${ID}/draft-pdf`, { responseType: 'blob' });
    expect(h.fetchOne).not.toHaveBeenCalled();
    expect(h.saveBlob).toHaveBeenCalledWith(blob, DRAFT.fileName);
  });

  it('birinchi bosish — fayldan KEYIN yangi GET /:id, nom undan', async () => {
    h.fetchOne.mockResolvedValue(dto({ draftPdf: DRAFT }));
    await downloadExpulsionDraftPdf(mapExpulsionOrder(dto()));
    expect(h.fetchOne).toHaveBeenCalledWith(`/expulsion-orders/${ID}`);
    expect(h.apiGet.mock.invocationCallOrder[0]).toBeLessThan(h.fetchOne.mock.invocationCallOrder[0] ?? 0);
    expect(h.saveBlob).toHaveBeenCalledWith(blob, DRAFT.fileName);
  });

  it('yangi GET yiqilsa yoki nom yo‘q — zaxira nom, fayl yo‘qolmaydi', async () => {
    h.fetchOne.mockRejectedValueOnce(httpError(500));
    await downloadExpulsionDraftPdf(mapExpulsionOrder(dto()));
    expect(h.saveBlob).toHaveBeenLastCalledWith(blob, 'chetlatish-buyrugi-loyihasi-0abc01.pdf');

    h.fetchOne.mockResolvedValueOnce(dto());
    await downloadExpulsionDraftPdf(mapExpulsionOrder(dto()));
    expect(h.saveBlob).toHaveBeenLastCalledWith(blob, 'chetlatish-buyrugi-loyihasi-0abc01.pdf');
  });

  it('fayl so‘rovi yiqilsa — xato XOM uzatiladi, saqlash va nom so‘rovi yo‘q', async () => {
    const err = httpError(404);
    h.apiGet.mockRejectedValue(err);
    await expect(downloadExpulsionDraftPdf(mapExpulsionOrder(dto()))).rejects.toBe(err);
    expect(h.fetchOne).not.toHaveBeenCalled();
    expect(h.saveBlob).not.toHaveBeenCalled();
  });
});

describe('downloadExpulsionScan', () => {
  it('GET /:id/scan blob sifatida, nom — skan DTO sidan', async () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    h.apiGet.mockResolvedValue({ data: blob });
    await downloadExpulsionScan(mapExpulsionOrder(dto({ scan: { fileName: 'imzolangan.png', sha256: SHA, size: 1 } })));
    expect(h.apiGet).toHaveBeenCalledWith(`/expulsion-orders/${ID}/scan`, { responseType: 'blob' });
    expect(h.saveBlob).toHaveBeenCalledWith(blob, 'imzolangan.png');
  });
});
