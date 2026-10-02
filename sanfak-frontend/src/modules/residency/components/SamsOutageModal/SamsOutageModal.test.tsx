import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App as AntdApp, ConfigProvider } from 'antd';
import { ThemeProvider, type DefaultTheme } from 'styled-components';
import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from '../../styles/theme';
import type { SamsOutageDraft } from '../../api/sams-status-types';
import { OUTAGE_ALL_CLINICS } from '../../lib/sams-outage-draft';
import SamsOutageModal from './index';

const m = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));

vi.mock('../../api/sams-status-api', () => ({
  useCreateSamsOutage: () => ({ mutateAsync: m.mutateAsync, isPending: m.isPending }),
}));

const TODAY = '2026-09-27';
const CLINICS = [
  { dbname: 'klinika_a', orgTitle: 'Akfa klinikasi' },
  { dbname: 'klinika_b', orgTitle: 'Respublika klinikasi' },
];

const draft = (over: Partial<SamsOutageDraft> = {}): SamsOutageDraft => ({
  from: '2026-09-20',
  to: '2026-09-22',
  dbname: 'klinika_a',
  reason: '',
  ...over,
});

function renderModal(d: SamsOutageDraft, onClose = vi.fn(), today: string | null = TODAY) {
  render(
    <ConfigProvider>
      <AntdApp>
        <ThemeProvider theme={theme as unknown as DefaultTheme}>
          <SamsOutageModal draft={d} clinics={CLINICS} today={today} onClose={onClose} />
        </ThemeProvider>
      </AntdApp>
    </ConfigProvider>,
  );
  return onClose;
}

const submitBtn = () => screen.getByRole('button', { name: /E.lon qilish/ });
const typeReason = (text: string) =>
  fireEvent.change(screen.getByLabelText('Sabab'), { target: { value: text } });

beforeEach(() => {
  m.mutateAsync.mockReset();
  m.isPending = false;
});

describe('SamsOutageModal', () => {
  it('prefill: klinika, sanalar va «E’lon qilish — Akfa klinikasi, 3 kun»', () => {
    renderModal(draft());
    expect(document.querySelector('.ant-select-selection-item')?.textContent).toBe(
      'Akfa klinikasi',
    );
    expect(screen.getByDisplayValue('2026-09-20')).toBeTruthy();
    expect(screen.getByDisplayValue('2026-09-22')).toBeTruthy();
    expect(submitBtn().textContent).toBe('E’lon qilish — Akfa klinikasi, 3 kun');
  });

  it('«barcha klinikalar» tanlovi ko‘rinadi va tugmada aytiladi', () => {
    renderModal(draft({ dbname: OUTAGE_ALL_CLINICS }));
    expect(document.querySelector('.ant-select-selection-item')?.textContent).toBe(
      'Barcha klinikalar',
    );
    expect(submitBtn().textContent).toBe('E’lon qilish — barcha klinikalar, 3 kun');
  });
});

describe('SamsOutageModal — qamrov standart emas', () => {
  it("🔴 qamrov tanlanmagan ('') — placeholder, so‘rov YUBORILMAYDI", async () => {
    renderModal(draft({ dbname: '', reason: 'SAMS serveri ishlamadi' }));
    expect(document.querySelector('.ant-select-selection-item')).toBeNull();
    expect(submitBtn().textContent).toBe('E’lon qilish — 3 kun');
    fireEvent.click(submitBtn());
    expect(
      await screen.findAllByText(/Klinikani yoki «Barcha klinikalar»ni tanlang/),
    ).not.toHaveLength(0);
    expect(m.mutateAsync).not.toHaveBeenCalled();
  });
});

describe('SamsOutageModal — so‘rovsiz rad', () => {
  it('sababsiz — so‘rov YUBORILMAYDI, ogohlantirish chiqadi', async () => {
    renderModal(draft());
    fireEvent.click(submitBtn());
    expect(await screen.findByText(/Sabab kamida 3 belgi/)).toBeTruthy();
    expect(m.mutateAsync).not.toHaveBeenCalled();
  });

  it('kelajak kuni — so‘rov YUBORILMAYDI', async () => {
    renderModal(draft({ to: '2026-09-28' }));
    typeReason('SAMS serveri ishlamadi');
    fireEvent.click(submitBtn());
    expect(await screen.findByText(/kelajakka e.lon qilinmaydi/)).toBeTruthy();
    expect(m.mutateAsync).not.toHaveBeenCalled();
  });
});

describe('SamsOutageModal — yuborish', () => {
  it('to‘g‘ri draft — bir marta, aynan shu qiymatlar bilan; keyin yopiladi', async () => {
    m.mutateAsync.mockResolvedValue({});
    const onClose = renderModal(draft({ dbname: OUTAGE_ALL_CLINICS }));
    typeReason('  SAMS serveri ishlamadi ');
    fireEvent.click(submitBtn());
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(m.mutateAsync).toHaveBeenCalledTimes(1);
    expect(m.mutateAsync).toHaveBeenCalledWith({
      from: '2026-09-20',
      to: '2026-09-22',
      dbname: OUTAGE_ALL_CLINICS,
      reason: '  SAMS serveri ishlamadi ',
    });
  });

  it('🔴 tez ikki bosish (qayta chizishdan oldin) — mutatsiya BIR marta', async () => {
    let release: (v: unknown) => void = () => undefined;
    m.mutateAsync.mockImplementation(() => new Promise((r) => (release = r)));
    renderModal(draft({ reason: 'SAMS serveri ishlamadi' }));
    const btn = submitBtn();
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => expect(m.mutateAsync).toHaveBeenCalled());
    expect(m.mutateAsync).toHaveBeenCalledTimes(1);
    release({});
  });

  it('isPending — tugma o‘chiq (ikki marta yuborish qalqoni)', () => {
    m.isPending = true;
    renderModal(draft({ reason: 'SAMS serveri ishlamadi' }));
    expect(submitBtn()).toBeDisabled();
  });

  it('server xatosi — xabar ko‘rsatiladi, oyna yopilmaydi', async () => {
    m.mutateAsync.mockRejectedValue(
      new AxiosError('x', 'ERR', undefined, undefined, {
        status: 400,
        statusText: '',
        data: { message: 'Bunday klinika SAMS ma’lumotlarida yo‘q', reason: 'unknown_clinic' },
        headers: {} as AxiosHeaders,
        config: { headers: new AxiosHeaders() },
      }),
    );
    const onClose = renderModal(draft({ reason: 'SAMS serveri ishlamadi' }));
    fireEvent.click(submitBtn());
    expect(await screen.findByText(/Bunday klinika SAMS/)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('server `today` bermasa — kelajak tekshiruvi serverga qoladi (so‘rov ketadi)', async () => {
    m.mutateAsync.mockResolvedValue({});
    renderModal(draft({ to: '2026-09-28', reason: 'SAMS serveri ishlamadi' }), vi.fn(), null);
    fireEvent.click(submitBtn());
    await waitFor(() => expect(m.mutateAsync).toHaveBeenCalledTimes(1));
  });
});
