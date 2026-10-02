import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mapExpulsionOrder } from '../api/expulsion-order-mapper';
import type { ExpulsionOrder } from '../api/expulsion-order-types';
import {
  KEY,
  ORDER_ID,
  RENDER_TIMEOUT_MS,
  RESUMABLE,
  SCAN,
  SHA,
  W5_HINT,
  button,
  dto,
  httpError,
  noButton,
  renderDetail,
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

function ListProbe() {
  const { pathname, search } = useLocation();
  return <div data-testid="list-location">{pathname + search}</div>;
}

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

describe('ChetlatishBuyrugiDetail — bayroqlar', { timeout: RENDER_TIMEOUT_MS }, () => {
  it('(a) hamma bayroq false — amal tugmasi YO‘Q, faktlar chiziladi', () => {
    setOrder(mapExpulsionOrder(dto()));
    renderDetail();
    expect(screen.getByText(/Aliyev Vali — chetlatish buyrug/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Asos' })).toBeInTheDocument();
    noButton(/^Imzolash$/);
    noButton(/Rad etish/);
    noButton(/skanni yuklash/i);
    noButton(/Skanni almashtirish/);
    noButton(/Loyiha PDF/);
    noButton(/Imzoni yakunlash/);
  });

  it('(a2) skan bor, bayroq yo‘q — faqat yuklab olish tugmasi (403 xabar bilan)', async () => {
    setOrder(mapExpulsionOrder(dto({ scan: SCAN })));
    api.downloadScan.mockRejectedValue(
      httpError(403, { message: "Faqat bo'lim xodimi (magistratura_bolim) bajaradi", reason: 'not_office_signer' }),
    );
    renderDetail();
    noButton(/skanni yuklash/i);
    fireEvent.click(button(/Skanni yuklab olish/));
    expect(await screen.findByText(/Faqat bo'lim xodimi/)).toBeInTheDocument();
  });

  it('(b) canUploadScan — yuklash tugmasi va imzo to‘sig‘i; 11 MB fayl so‘rovsiz rad', async () => {
    setOrder(mapExpulsionOrder(dto({ canUploadScan: true, canReject: true })));
    renderDetail();
    expect(button(/Imzolangan skanni yuklash/)).toBeInTheDocument();
    expect(screen.getByText(/avval imzolangan qog.oz skanini yuklang/)).toBeInTheDocument();

    const big = new File(['x'], 'skan.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 });
    fireEvent.change(screen.getByTestId('expulsion-scan-input'), { target: { files: [big] } });
    expect(await screen.findByText('Fayl hajmi 10 MB dan oshmasin')).toBeInTheDocument();
    expect(api.uploadMutate).not.toHaveBeenCalled();
  });

  it('(b2) yaroqli skan — faqat {id, file} bilan yuklanadi', () => {
    setOrder(mapExpulsionOrder(dto({ canUploadScan: true })));
    renderDetail();
    const file = new File(['%PDF-1.4'], 'skan.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByTestId('expulsion-scan-input'), { target: { files: [file] } });
    expect(api.uploadMutate).toHaveBeenCalledTimes(1);
    expect(api.uploadMutate.mock.calls[0]?.[0]).toEqual({ id: ORDER_ID, file });
  });

  it('(b3) nofaol rezident — imzo to‘sig‘i sababi', () => {
    setOrder(
      mapExpulsionOrder(
        dto({ canUploadScan: true, scan: SCAN, resident: { _id: 'r1', fullName: 'Aliyev Vali', active: false, status: 'oquvda' } }),
      ),
    );
    renderDetail();
    expect(screen.getByText(/Rezident nofaol — migratsiya yakunlanmagan/)).toBeInTheDocument();
  });

  it('(c) canSign — tasdiqdan keyin AYNAN tana: trim, ERI yo‘q', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-27T06:00:00Z'));
    setOrder(mapExpulsionOrder(dto({ canSign: true, canUploadScan: true, canReject: true, scan: SCAN })));
    renderDetail();

    fireEvent.change(screen.getByLabelText('Buyruq raqami'), { target: { value: ' 12-ch ' } });
    fireEvent.click(screen.getByLabelText('Buyruq sanasi'));
    expect(await screen.findByTitle('2026-09-28')).toHaveClass('ant-picker-cell-disabled');
    expect(screen.getByTitle('2026-09-19')).toHaveClass('ant-picker-cell-disabled');
    fireEvent.click(screen.getByTitle('2026-09-25'));
    fireEvent.click(button(/^Imzolash$/));

    expect(await screen.findByText(/qaytarib bo.lmaydi/)).toBeInTheDocument();
    expect(api.signMutateAsync).not.toHaveBeenCalled();

    fireEvent.click(button(/Ha, imzolash/));
    await waitFor(() => expect(api.signMutateAsync).toHaveBeenCalledTimes(1));
    const arg = api.signMutateAsync.mock.calls[0]?.[0] as { id: string; payload: Record<string, unknown> };
    expect(arg).toEqual({
      id: ORDER_ID,
      payload: { orderId: ORDER_ID, paperOrderNumber: '12-ch', paperOrderDate: '2026-09-25', scanSha256: SHA },
    });
    expect('eriSignature' in arg.payload).toBe(false);
    expect('eriKey' in arg.payload).toBe(false);
  });

  it('(c2) canSign — sana tanlanmasa xato, tasdiq oynasi ochilmaydi', async () => {
    setOrder(mapExpulsionOrder(dto({ canSign: true, scan: SCAN })));
    renderDetail();
    fireEvent.change(screen.getByLabelText('Buyruq raqami'), { target: { value: '12-ch' } });
    fireEvent.click(button(/^Imzolash$/));
    expect(await screen.findByText('Buyruq sanasini tanlang')).toBeInTheDocument();
    expect(screen.queryByText(/Ha, imzolash/)).toBeNull();
  });

  it('(d) needsResume + canResume — tasdiqdan keyin DTO qiymatlari AYNAN', async () => {
    setOrder(mapExpulsionOrder(dto(RESUMABLE)));
    renderDetail();
    fireEvent.click(button(/Imzoni yakunlash/));
    fireEvent.click(await screen.findByRole('button', { name: /Ha, yakunlash/ }));
    await waitFor(() => expect(api.signMutateAsync).toHaveBeenCalledTimes(1));
    expect(api.signMutateAsync.mock.calls[0]?.[0]).toEqual({
      id: ORDER_ID,
      payload: { orderId: ORDER_ID, paperOrderNumber: ' 12-ch ', paperOrderDate: '2026-09-25', scanSha256: SHA },
    });
  });

  it('(d2) needsResume, canResume YO‘Q — tugmasiz izoh', () => {
    setOrder(mapExpulsionOrder(dto({ status: 'imzolangan', paperOrderNumber: '1', paperOrderDate: '2026-09-25', scan: SCAN, needsResume: true })));
    renderDetail();
    expect(screen.getByText(/bo.lim xodimi yakunlashi kerak/)).toBeInTheDocument();
    noButton(/Imzoni yakunlash/);
  });

  it('(e) canReject — 2 belgi: tugma o‘chiq; to‘g‘ri sabab trim bilan yuboriladi', async () => {
    setOrder(mapExpulsionOrder(dto({ canReject: true })));
    renderDetail();
    fireEvent.click(button(/^Rad etish$/));
    const textarea = screen.getByLabelText('Rad etish sababi');

    fireEvent.change(textarea, { target: { value: 'ab' } });
    expect(button(/Loyihani rad etish/)).toBeDisabled();

    fireEvent.change(textarea, { target: { value: '  Hujjatlar to‘liq emas  ' } });
    expect(button(/Loyihani rad etish/)).not.toBeDisabled();
    fireEvent.click(button(/Loyihani rad etish/));
    await waitFor(() =>
      expect(api.rejectMutateAsync).toHaveBeenCalledWith({ id: ORDER_ID, reason: 'Hujjatlar to‘liq emas' }),
    );
    expect(await screen.findByText('Loyiha rad etildi')).toBeInTheDocument();
  });

  it('(f) canGetDraftPdf — yuklab olish chaqiriladi va so‘rovlar yangilanadi', async () => {
    setOrder(mapExpulsionOrder(dto({ canGetDraftPdf: true })));
    const { invalidate } = renderDetail();
    expect(screen.getByText(/birinchi bosishda yaratiladi va muzlatiladi/)).toBeInTheDocument();
    expect(screen.getByText(W5_HINT)).toBeInTheDocument();
    fireEvent.click(button(/Loyiha PDF.ini yuklab olish/));
    await waitFor(() => expect(api.downloadDraft).toHaveBeenCalledTimes(1));
    expect(api.downloadDraft.mock.calls[0]?.[0]).toMatchObject({ id: ORDER_ID });
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: [KEY] }));
  });

  it('(f2) skan allaqachon bor — W-5 ogohlantirishi YO‘Q (birinchi bosish izohi qoladi)', () => {
    setOrder(mapExpulsionOrder(dto({ canGetDraftPdf: true, scan: SCAN })));
    renderDetail();
    expect(screen.getByText(/birinchi bosishda yaratiladi va muzlatiladi/)).toBeInTheDocument();
    expect(screen.queryByText(W5_HINT)).toBeNull();
  });

  it('(g) 409 order_not_open — server matni ko‘rsatiladi va buyruq qayta so‘raladi', async () => {
    setOrder(mapExpulsionOrder(dto({ canReject: true })));
    api.rejectMutateAsync.mockRejectedValue(
      httpError(409, {
        message: 'Buyruq endi loyiha emas — sahifani yangilang',
        reason: 'order_not_open',
        currentStatus: 'bekor_qilingan',
      }),
    );
    const { invalidate } = renderDetail();
    fireEvent.click(button(/^Rad etish$/));
    fireEvent.change(screen.getByLabelText('Rad etish sababi'), { target: { value: 'Sabab matni' } });
    fireEvent.click(button(/Loyihani rad etish/));
    expect(await screen.findByText(/Buyruq endi loyiha emas.*Bekor qilingan/)).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: [KEY] });
  });
});

describe('ChetlatishBuyrugiDetail — so‘rov holati', { timeout: RENDER_TIMEOUT_MS }, () => {
  it('404 — «Buyruq topilmadi»', () => {
    api.query = { data: undefined, isLoading: false, isError: true, error: httpError(404, {}) };
    renderDetail();
    expect(screen.getByText(/Buyruq topilmadi yoki rezident o.chirilgan/)).toBeInTheDocument();
  });

  it('eski ma’lumot + 404 bo‘lmagan xato (500) — buyruq ko‘rinishda qoladi', () => {
    api.query = { data: mapExpulsionOrder(dto()), isLoading: false, isError: true, error: httpError(500, {}) };
    renderDetail();
    expect(screen.getByText(/Aliyev Vali — chetlatish buyrug/)).toBeInTheDocument();
  });

  it('«Buyruqlar ro‘yxati» — ro‘yxatdan kelgan tab/sahifaga qaytadi', () => {
    setOrder(mapExpulsionOrder(dto()));
    renderDetail({ listSearch: 'status=imzolangan&page=3' }, <ListProbe />);
    fireEvent.click(button(/Buyruqlar ro.yxati/));
    expect(screen.getByTestId('list-location').textContent).toBe(
      '/residency/chetlatish-buyruqlari?status=imzolangan&page=3',
    );
  });

  it('«Buyruqlar ro‘yxati» — to‘g‘ridan-to‘g‘ri ochilgan (state yo‘q) — standart ro‘yxat', () => {
    setOrder(mapExpulsionOrder(dto()));
    renderDetail(undefined, <ListProbe />);
    fireEvent.click(button(/Buyruqlar ro.yxati/));
    expect(screen.getByTestId('list-location').textContent).toBe('/residency/chetlatish-buyruqlari');
  });

  it('403 — ruxsat yo‘q', () => {
    api.query = { data: undefined, isLoading: false, isError: true, error: httpError(403, {}) };
    renderDetail();
    expect(screen.getByText(/ko.rish huquqingiz yo.q/i)).toBeInTheDocument();
  });
});

describe('ChetlatishBuyrugiDetail — tarix', { timeout: RENDER_TIMEOUT_MS }, () => {
  it('`sams` manbasi — «SAMS davomati», xom kalit EMAS (I3-Q14)', () => {
    const history = [{ at: '2026-09-28T03:00:00.000Z', action: 'yaratildi', source: 'sams' }];
    setOrder(mapExpulsionOrder(dto({ history })));
    renderDetail();
    const panel = within(screen.getByRole('region', { name: 'Tarix' }));
    expect(panel.getByText(/· SAMS davomati ·/)).toBeInTheDocument();
    expect(panel.queryByText(/· sams ·/)).toBeNull();
  });
});
