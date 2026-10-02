import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntdApp, ConfigProvider } from 'antd';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider, type DefaultTheme } from 'styled-components';
import { AxiosError, AxiosHeaders } from 'axios';
import { expect, vi } from 'vitest';
import { theme } from '../styles/theme';
import type { BackendExpulsionOrder } from '../api/expulsion-order-mapper';
import ChetlatishBuyrugiDetail from './ChetlatishBuyrugiDetail';

export const ORDER_ID = '65f0000000000000000abc01';
export const SHA = 'd'.repeat(64);
export const KEY = 'residency-expulsion-orders';

export const NO_FLAGS = {
  canUploadScan: false,
  canReject: false,
  canSign: false,
  needsResume: false,
  canResume: false,
  canGetDraftPdf: false,
};

export const SCAN = { fileName: 'imzolangan.pdf', mimeType: 'application/pdf', size: 4096, sha256: SHA, uploadedAt: '2026-09-24T05:00:00.000Z' };

export const dto = (over: Partial<BackendExpulsionOrder> = {}): BackendExpulsionOrder => ({
  _id: ORDER_ID,
  resident: {
    _id: 'r1',
    fullName: 'Aliyev Vali',
    program: 'ordinatura',
    courseNumber: 2,
    status: 'oquvda',
    totalUnexcusedHours: 74,
    active: true,
  },
  origin: 'tizim',
  status: 'loyiha',
  countingYear: '2026-2027',
  draftedAt: '2026-09-20T03:00:00.000Z',
  hoursAtDraft: 72,
  noticesSentAt: '2026-09-20T03:00:05.000Z',
  history: [{ at: '2026-09-20T03:00:00.000Z', action: 'yaratildi', source: 'cron', hours: 72 }],
  ...NO_FLAGS,
  ...over,
});

export const httpError = (status: number, data: unknown) =>
  new AxiosError('xato', 'ERR', undefined, undefined, {
    status,
    statusText: '',
    data,
    headers: {} as AxiosHeaders,
    config: { headers: new AxiosHeaders() },
  });

export function renderDetail(state?: unknown, listElement: ReactNode = null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);
  render(
    <QueryClientProvider client={client}>
      <ConfigProvider>
        <AntdApp>
          <ThemeProvider theme={theme as unknown as DefaultTheme}>
            <MemoryRouter initialEntries={[{ pathname: `/residency/chetlatish-buyruqlari/${ORDER_ID}`, state }]}>
              <Routes>
                <Route path="/residency/chetlatish-buyruqlari" element={listElement} />
                <Route path="/residency/chetlatish-buyruqlari/:id" element={<ChetlatishBuyrugiDetail />} />
              </Routes>
            </MemoryRouter>
          </ThemeProvider>
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>,
  );
  return { invalidate };
}

export const button = (name: RegExp | string) => screen.getByRole('button', { name });
export const noButton = (name: RegExp) => expect(screen.queryByRole('button', { name })).toBeNull();

export const W5_HINT = /Skan yuklangach tizim loyiha PDF.ini yaratmaydi/;

export const RESUMABLE: Partial<BackendExpulsionOrder> = {
  status: 'imzolangan',
  paperOrderNumber: ' 12-ch ',
  paperOrderDate: '2026-09-25',
  scan: SCAN,
  signedAt: '2026-09-25T06:00:00.000Z',
  needsResume: true,
  canResume: true,
};

export async function signThroughConfirm() {
  fireEvent.change(screen.getByLabelText('Buyruq raqami'), { target: { value: ' 12-ch ' } });
  fireEvent.click(screen.getByLabelText('Buyruq sanasi'));
  fireEvent.click(await screen.findByTitle('2026-09-25'));
  fireEvent.click(button(/^Imzolash$/));
  fireEvent.click(await screen.findByRole('button', { name: /Ha, imzolash/ }));
}

export const RENDER_TIMEOUT_MS = 30_000;
