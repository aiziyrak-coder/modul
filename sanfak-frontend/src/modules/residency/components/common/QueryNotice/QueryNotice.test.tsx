import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { ThemeProvider, type DefaultTheme } from 'styled-components';
import QueryNotice from './index';
import { combineState, type QueryState } from '../../../lib/query-state';
import { theme } from '../../../styles/theme';

const q = (over: Partial<QueryState> = {}): QueryState => ({
  isLoading: false,
  isError: false,
  error: null,
  ...over,
});

const httpError = (status: number) =>
  new AxiosError('xato', 'ERR', undefined, undefined, {
    status,
    statusText: '',
    data: {},
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

describe('combineState', () => {
  it('hammasi tinch — ok', () => {
    expect(combineState([q(), q()])).toBe('ok');
  });

  it('bittasi yuklanmoqda — loading (xato bo‘lsa ham)', () => {
    expect(combineState([q({ isLoading: true }), q({ isError: true })])).toBe('loading');
  });

  it('🔴 403 — forbidden (ilgari bo‘sh ro‘yxat bo‘lib ko‘rinardi)', () => {
    expect(combineState([q({ isError: true, error: httpError(403) })])).toBe('forbidden');
  });

  it('500 — error', () => {
    expect(combineState([q({ isError: true, error: httpError(500) })])).toBe('error');
  });

  it('ARALASH holat — `error`, `forbidden` EMAS', () => {
    expect(
      combineState([
        q({ isError: true, error: httpError(403) }),
        q({ isError: true, error: httpError(500) }),
      ]),
    ).toBe('error');
  });

  it('Axios bo‘lmagan xato — error', () => {
    expect(combineState([q({ isError: true, error: new Error('tarmoq') })])).toBe('error');
  });

  it('bo‘sh ro‘yxat — ok', () => {
    expect(combineState([])).toBe('ok');
  });
});

const wrap = (ui: React.ReactNode) => (
  <ThemeProvider theme={theme as unknown as DefaultTheme}>{ui}</ThemeProvider>
);

describe('QueryNotice ekranda', () => {
  it('forbidden — ruxsat yo‘qligi ANIQ aytiladi', () => {
    render(wrap(<QueryNotice state="forbidden" onRetry={() => {}} />));
    expect(screen.getByText(/ko.rish huquqingiz yo.q/i)).toBeTruthy();
  });

  it('forbidden — «qayta urinish» tugmasi KO‘RSATILMAYDI', () => {
    render(wrap(<QueryNotice state="forbidden" onRetry={() => {}} />));
    expect(screen.queryByText(/qayta urinish/i)).toBeNull();
  });

  it('error — qayta urinish tugmasi bor va ishlaydi', () => {
    const onRetry = vi.fn();
    render(wrap(<QueryNotice state="error" onRetry={onRetry} />));
    screen.getByText(/qayta urinish/i).click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('loading — neytral matn, xato rangi yo‘q', () => {
    render(wrap(<QueryNotice state="loading" onRetry={() => {}} />));
    expect(screen.getByText(/yuklanmoqda/i)).toBeTruthy();
    expect(screen.queryByText(/huquqingiz yo.q/i)).toBeNull();
  });
});
