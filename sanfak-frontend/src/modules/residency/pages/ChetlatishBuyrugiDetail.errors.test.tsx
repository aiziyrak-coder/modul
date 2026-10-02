import { fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mapExpulsionOrder } from '../api/expulsion-order-mapper';
import type { ExpulsionOrder } from '../api/expulsion-order-types';
import {
  KEY,
  RENDER_TIMEOUT_MS,
  RESUMABLE,
  SCAN,
  button,
  dto,
  httpError,
  noButton,
  renderDetail,
  signThroughConfirm,
} from './ChetlatishBuyrugiDetail.test.fixtures';

const api = vi.hoisted(() => ({
  query: null as unknown as { data: unknown; isLoading: boolean; isError: boolean; error: unknown },
  signMutateAsync: vi.fn(),
  rejectMutateAsync: vi.fn(),
  uploadMutate: vi.fn(),
  downloadDraft: vi.fn(),
  downloadScan: vi.fn(),
}));

vi.mock('../api/expulsion-order-api', () => ({
  EXPULSION_ORDER_KEY: 'residency-expulsion-orders',
  useExpulsionOrder: () => ({ ...api.query, refetch: vi.fn() }),
  useSignExpulsionOrder: () => ({ mutateAsync: api.signMutateAsync, isPending: false }),
  useRejectExpulsionOrder: () => ({ mutateAsync: api.rejectMutateAsync, isPending: false }),
  useUploadExpulsionScan: () => ({ mutate: api.uploadMutate, isPending: false }),
  downloadExpulsionDraftPdf: api.downloadDraft,
  downloadExpulsionScan: api.downloadScan,
}));

const setOrder = (order: ExpulsionOrder) => {
  api.query = { data: order, isLoading: false, isError: false, error: null };
};

beforeEach(() => {
  vi.clearAllMocks();
  api.signMutateAsync.mockResolvedValue({});
  api.rejectMutateAsync.mockResolvedValue({});
  api.downloadDraft.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ChetlatishBuyrugiDetail — imzo xatosi JIM yutilmaydi', { timeout: RENDER_TIMEOUT_MS }, () => {
  it('(h) yangi imzo 400 paper_date_invalid — oraliq xabarda, qayta so‘rash va muvaffaqiyat YO‘Q', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-27T06:00:00Z'));
    setOrder(mapExpulsionOrder(dto({ canSign: true, scan: SCAN })));
    api.signMutateAsync.mockRejectedValue(
      httpError(400, {
        message: "Buyruq sanasi noto'g'ri",
        reason: 'paper_date_invalid',
        min: '2026-09-20',
        max: '2026-09-27',
      }),
    );
    const { invalidate } = renderDetail();

    await signThroughConfirm();

    expect(await screen.findByText(/Ruxsat etilgan oraliq: 2026-09-20 — 2026-09-27/)).toBeInTheDocument();
    expect(api.signMutateAsync).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Buyruq imzolandi/)).toBeNull();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('(h2) yangi imzo 409 scan_changed — xabar va buyruq qayta so‘raladi', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-27T06:00:00Z'));
    setOrder(mapExpulsionOrder(dto({ canSign: true, scan: SCAN })));
    api.signMutateAsync.mockRejectedValue(
      httpError(409, { message: 'Skan almashtirilgan — sahifani yangilang', reason: 'scan_changed' }),
    );
    const { invalidate } = renderDetail();

    await signThroughConfirm();

    expect(await screen.findByText('Skan almashtirilgan — sahifani yangilang')).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: [KEY] });
    expect(screen.queryByText(/Buyruq imzolandi/)).toBeNull();
  });

  it('(i) yarim imzoni yakunlash 409 scan_changed — xabar va buyruq qayta so‘raladi', async () => {
    setOrder(mapExpulsionOrder(dto(RESUMABLE)));
    api.signMutateAsync.mockRejectedValue(
      httpError(409, { message: 'Skan almashtirilgan — sahifani yangilang', reason: 'scan_changed' }),
    );
    const { invalidate } = renderDetail();

    fireEvent.click(button(/Imzoni yakunlash/));
    fireEvent.click(await screen.findByRole('button', { name: /Ha, yakunlash/ }));

    expect(await screen.findByText('Skan almashtirilgan — sahifani yangilang')).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: [KEY] });
    expect(screen.queryByText(/Imzo yakunlandi/)).toBeNull();
  });

  it('(i2) yakunlash 500 — server xatosi ko‘rsatiladi', async () => {
    setOrder(mapExpulsionOrder(dto(RESUMABLE)));
    api.signMutateAsync.mockRejectedValue(httpError(500, {}));
    renderDetail();

    fireEvent.click(button(/Imzoni yakunlash/));
    fireEvent.click(await screen.findByRole('button', { name: /Ha, yakunlash/ }));

    expect(await screen.findByText(/Server xatosi/)).toBeInTheDocument();
  });
});

describe('ChetlatishBuyrugiDetail — 404 poygasi sahifani yangilaydi', { timeout: RENDER_TIMEOUT_MS }, () => {
  it('(j) loyiha PDF 404 draft_pdf_missing (sweep yopgan) — xabar va buyruq qayta so‘raladi', async () => {
    setOrder(mapExpulsionOrder(dto({ canGetDraftPdf: true, canReject: true })));
    api.downloadDraft.mockRejectedValue(
      httpError(404, { message: "Bu buyruq uchun loyiha PDF'i yaratilmagan", reason: 'draft_pdf_missing' }),
    );
    const { invalidate } = renderDetail();
    fireEvent.click(button(/Loyiha PDF.ini yuklab olish/));
    expect(await screen.findByText("Bu buyruq uchun loyiha PDF'i yaratilmagan")).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: [KEY] });
  });

  it('(j2) rad etish 404 resident_not_found — buyruq qayta so‘raladi', async () => {
    setOrder(mapExpulsionOrder(dto({ canReject: true })));
    api.rejectMutateAsync.mockRejectedValue(
      httpError(404, { message: 'Rezident topilmadi', reason: 'resident_not_found' }),
    );
    const { invalidate } = renderDetail();
    fireEvent.click(button(/^Rad etish$/));
    fireEvent.change(screen.getByLabelText('Rad etish sababi'), { target: { value: 'Sabab matni' } });
    fireEvent.click(button(/Loyihani rad etish/));
    expect(await screen.findByText('Rezident topilmadi')).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: [KEY] });
  });

  it('(k) qayta so‘rov 404, eski ma’lumot saqlangan — «topilmadi», eski buyruq va tugmalar YO‘Q', () => {
    api.query = {
      data: mapExpulsionOrder(dto({ canReject: true, canGetDraftPdf: true })),
      isLoading: false,
      isError: true,
      error: httpError(404, { reason: 'order_not_found' }),
    };
    renderDetail();
    expect(screen.getByText(/Buyruq topilmadi yoki rezident o.chirilgan/)).toBeInTheDocument();
    expect(screen.queryByText(/Aliyev Vali — chetlatish buyrug/)).toBeNull();
    noButton(/Rad etish/);
    noButton(/Loyiha PDF/);
  });
});
