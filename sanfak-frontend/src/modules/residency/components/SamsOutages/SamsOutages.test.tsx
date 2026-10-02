import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App as AntdApp, ConfigProvider } from 'antd';
import { ThemeProvider, type DefaultTheme } from 'styled-components';
import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from '../../styles/theme';
import { mapOutage } from '../../api/sams-status-mapper';
import type { SamsOutageListParams } from '../../api/sams-status-api';
import SamsOutages from './index';

const m = vi.hoisted(() => ({
  calls: [] as SamsOutageListParams[],
  cancel: vi.fn(),
  total: null as number | null,
  isError: false,
}));

const ITEMS = [
  mapOutage({
    _id: 'o1',
    from: '2026-09-20',
    to: '2026-09-22',
    dbname: null,
    orgTitle: null,
    reason: 'Server ishlamadi',
    createdBy: { firstName: 'Vali', lastName: 'Aliyev' },
  }),
  mapOutage({
    _id: 'o2',
    from: '2026-09-10',
    to: '2026-09-10',
    dbname: 'klinika_a',
    orgTitle: 'Akfa klinikasi',
    reason: 'Tarmoq uzildi',
    cancelledAt: '2026-09-11T05:00:00.000Z',
    cancelReason: 'Xato e’lon',
  }),
];

function pageOf(page: number, total: number) {
  const all = Array.from({ length: total }, (_, i) => ({ ...ITEMS[0], id: `o${i}` }));
  return {
    items: all.slice((page - 1) * 20, page * 20),
    total,
    page,
    totalPages: Math.ceil(total / 20),
    hasNextPage: page * 20 < total,
  };
}

vi.mock('../../api/sams-status-api', () => ({
  useSamsOutages: (params: SamsOutageListParams) => {
    m.calls.push(params);
    const data =
      m.total === null
        ? { items: ITEMS, total: 2, page: 1, totalPages: 1, hasNextPage: false }
        : pageOf(params.page, m.total);
    return {
      data,
      isLoading: false,
      isError: m.isError,
      error: m.isError ? new Error('502') : null,
      dataUpdatedAt: Date.parse('2026-09-27T05:00:00.000Z'),
      refetch: vi.fn(),
    };
  },
  useCancelSamsOutage: () => ({ mutateAsync: m.cancel, isPending: false }),
}));

const tree = (canWrite: boolean) => (
  <ConfigProvider>
    <AntdApp>
      <ThemeProvider theme={theme as unknown as DefaultTheme}>
        <SamsOutages canWrite={canWrite} />
      </ThemeProvider>
    </AntdApp>
  </ConfigProvider>
);

function renderIt(canWrite = true) {
  return render(tree(canWrite));
}

beforeEach(() => {
  m.calls.length = 0;
  m.cancel.mockReset();
  m.total = null;
  m.isError = false;
});

describe('SamsOutages', () => {
  it('standart — faol oynalar, 20 tadan', () => {
    renderIt();
    expect(m.calls[0]).toEqual({ page: 1, limit: 20, status: 'active' });
  });

  it('barcha klinikalar, oraliq kunlari, bekor qilingan oynada amal yo‘q', () => {
    renderIt();
    expect(screen.getByText('Barcha klinikalar')).toBeTruthy();
    expect(screen.getByText('3 kun')).toBeTruthy();
    expect(screen.getByText('Bekor qilingan')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Bekor qilish' })).toHaveLength(1);
  });

  it('yozish huquqisiz — «Bekor qilish» yo‘q', () => {
    renderIt(false);
    expect(screen.queryByRole('button', { name: 'Bekor qilish' })).toBeNull();
  });

  it('bekor qilish: sababsiz tugma o‘chiq; sabab bilan — id va sabab yuboriladi', async () => {
    m.cancel.mockResolvedValue({});
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: 'Bekor qilish' }));
    const confirm = () =>
      screen.getAllByRole('button', { name: 'Bekor qilish' }).at(-1) as HTMLElement;
    expect(confirm()).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Bekor qilish sababi'), {
      target: { value: 'Xato e’lon qilingan' },
    });
    fireEvent.click(confirm());
    await waitFor(() =>
      expect(m.cancel).toHaveBeenCalledWith({ id: 'o1', reason: 'Xato e’lon qilingan' }),
    );
  });

  it('🔴 tez ikki bosish (qayta chizishdan oldin) — bekor qilish BIR marta', async () => {
    m.cancel.mockImplementation(() => new Promise(() => undefined));
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: 'Bekor qilish' }));
    fireEvent.change(screen.getByLabelText('Bekor qilish sababi'), {
      target: { value: 'Xato e’lon qilingan' },
    });
    const confirm = screen.getAllByRole('button', { name: 'Bekor qilish' }).at(-1) as HTMLElement;
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(m.cancel).toHaveBeenCalled());
    expect(m.cancel).toHaveBeenCalledTimes(1);
  });

  it('oxirgi sahifadagi yagona oyna ketdi — bo‘sh sahifada qolmaydi (oxirgisiga qaytadi)', async () => {
    m.total = 21;
    const view = renderIt();
    fireEvent.click(screen.getByRole('button', { name: '2-sahifa' }));
    expect(m.calls.at(-1)?.page).toBe(2);
    expect(screen.getAllByRole('button', { name: 'Bekor qilish' })).toHaveLength(1);
    m.total = 20;
    view.rerender(tree(true));
    await waitFor(() => expect(m.calls.at(-1)?.page).toBe(1));
    expect(screen.getAllByRole('button', { name: 'Bekor qilish' })).toHaveLength(20);
    expect(screen.queryByText('Uzilish oynalari yo‘q')).toBeNull();
  });

  it('qayta so‘rov yiqildi (data bor) — jadval qoladi, kichik izoh bilan', () => {
    m.isError = true;
    renderIt();
    expect(screen.getByText('Barcha klinikalar')).toBeTruthy();
    expect(screen.getByText(/Yangilab bo.lmadi — ko.rsatilgan holat 10:00 dagi/)).toBeTruthy();
    expect(screen.queryByText(/Ma.lumotni yuklab bo.lmadi/)).toBeNull();
  });

  it('409 — server xabari ko‘rsatiladi', async () => {
    m.cancel.mockRejectedValue(
      new AxiosError('x', 'ERR', undefined, undefined, {
        status: 409,
        statusText: '',
        data: { message: 'Uzilish oynasi allaqachon bekor qilingan', reason: 'already_cancelled' },
        headers: {} as AxiosHeaders,
        config: { headers: new AxiosHeaders() },
      }),
    );
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: 'Bekor qilish' }));
    fireEvent.change(screen.getByLabelText('Bekor qilish sababi'), {
      target: { value: 'Xato e’lon qilingan' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Bekor qilish' }).at(-1) as HTMLElement);
    expect(await screen.findByText(/allaqachon bekor qilingan/)).toBeTruthy();
  });
});
