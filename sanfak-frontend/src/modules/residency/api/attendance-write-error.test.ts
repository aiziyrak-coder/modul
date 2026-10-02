import { createElement, type ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SharedApi from '@/shared/api';
import {
  ATTENDANCE_STATE_CHANGED_TEXT,
  EXCUSE_ERROR_TEXT,
  attendanceExcuseErrorText,
  attendanceUpdateErrorText,
  excuseErrorClosesModal,
  isAttendanceStateChanged,
  isExcuseRowNotAbsent,
} from './attendance-write-error';
import { ATT_KEY, RES_KEY, useApproveExcuse, useUpdateAttendance } from './residency-api';

const h = vi.hoisted(() => ({ putJson: vi.fn() }));

vi.mock('@/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedApi>()),
  putJson: h.putJson,
}));

const httpError = (status: number, data: Record<string, unknown> = {}) =>
  new AxiosError('xato', 'ERR', undefined, undefined, {
    status,
    statusText: '',
    data,
    headers: {} as AxiosHeaders,
    config: { headers: new AxiosHeaders() },
  });

const STATE_CHANGED = httpError(409, {
  message: "Yozuv shu orada o'zgardi — sahifani yangilab, qayta urinib ko'ring",
  reason: 'state_changed',
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('attendanceUpdateErrorText', () => {
  it('409 state_changed — qotirilgan o‘zbekcha matn', () => {
    expect(isAttendanceStateChanged(STATE_CHANGED)).toBe(true);
    expect(attendanceUpdateErrorText(STATE_CHANGED)).toBe(ATTENDANCE_STATE_CHANGED_TEXT);
    expect(ATTENDANCE_STATE_CHANGED_TEXT).toBe(
      'Yozuv shu orada o‘zgardi — sahifani yangilab, qayta urinib ko‘ring',
    );
  });

  it.each([
    ['409 boshqa sabab', httpError(409, { reason: 'auto_notice_readonly', message: 'Band' }), 'Band'],
    ['400 state_changed (status mos emas)', httpError(400, { reason: 'state_changed', message: 'X' }), 'X'],
    ['400 duplicate_lesson', httpError(400, { reason: 'duplicate_lesson', message: 'Dublikat' }), 'Dublikat'],
  ])('%s — server matni, state_changed EMAS', (_label, err, text) => {
    expect(isAttendanceStateChanged(err)).toBe(false);
    expect(attendanceUpdateErrorText(err)).toBe(text);
  });

  it('Axios bo‘lmagan / tanasiz xato — state_changed emas', () => {
    expect(isAttendanceStateChanged(new Error('state_changed'))).toBe(false);
    expect(isAttendanceStateChanged(httpError(409))).toBe(false);
    expect(isAttendanceStateChanged(null)).toBe(false);
  });
});

describe('attendanceExcuseErrorText (EXC)', () => {
  const NOT_ABSENT = httpError(409, {
    message: "Mashg'ulot yozuvi «kelmadi» holatida emas — sababli qilib bo'lmaydi",
    reason: 'session_row_not_absent',
  });

  it('isExcuseRowNotAbsent: faqat 409 + session_row_not_absent', () => {
    expect(isExcuseRowNotAbsent(NOT_ABSENT)).toBe(true);
    expect(isExcuseRowNotAbsent(STATE_CHANGED)).toBe(false);
    expect(isExcuseRowNotAbsent(httpError(403, { reason: 'session_row_not_absent' }))).toBe(false);
    expect(isExcuseRowNotAbsent(new Error('session_row_not_absent'))).toBe(false);
  });

  it('qotirilgan matnlar — o‘zbekcha, server tiliga bog‘lanmaydi', () => {
    expect(EXCUSE_ERROR_TEXT).toEqual({
      notAbsent: 'Bu dars endi «Kelmadi» holatida emas — jadval yangilandi',
      forbidden: 'Sababli qilish huquqingiz yo‘q',
      notFound: 'Yozuv topilmadi — sahifani yangilang',
    });
  });

  it.each([
    ['409 session_row_not_absent', NOT_ABSENT, EXCUSE_ERROR_TEXT.notAbsent, true],
    ['403', httpError(403, { message: 'Forbidden' }), EXCUSE_ERROR_TEXT.forbidden, false],
    ['404 inglizcha «not found»', httpError(404, { message: 'not found' }), EXCUSE_ERROR_TEXT.notFound, true],
    ['404 «Topilmadi»', httpError(404, { message: 'Topilmadi' }), EXCUSE_ERROR_TEXT.notFound, true],
    ['400 (qayta hisob yiqildi)', httpError(400, { message: 'Sababni tasdiqlashda xato' }), 'Sababni tasdiqlashda xato', false],
    ['409 boshqa sabab — server matni', httpError(409, { reason: 'state_changed', message: 'Band' }), 'Band', false],
    ['Axios bo‘lmagan xato', new Error('tarmoq'), 'tarmoq', false],
    ['noma’lum qiymat — zaxira matn', null, 'Sababni tasdiqlashda xatolik', false],
  ])('%s', (_label, err, text, closes) => {
    expect(attendanceExcuseErrorText(err)).toBe(text);
    expect(excuseErrorClosesModal(err)).toBe(closes);
  });
});

function setup() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidate = vi.spyOn(qc, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
  return { invalidate, wrapper };
}

describe('useUpdateAttendance — 409 state_changed', () => {
  it('xato chaqiruvchiga qaytadi VA jurnal keshi qayta o‘qiladi', async () => {
    h.putJson.mockRejectedValueOnce(STATE_CHANGED);
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useUpdateAttendance(), { wrapper });

    await expect(
      result.current.mutateAsync({ id: 'a1', data: { status: 'absent' } }),
    ).rejects.toBe(STATE_CHANGED);
    expect(h.putJson).toHaveBeenCalledWith('/attendance/a1', expect.any(Object));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: [ATT_KEY] });
  });

  it('boshqa xato — kesh tegilmaydi (hech narsa o‘zgarmagan)', async () => {
    h.putJson.mockRejectedValueOnce(httpError(400, { reason: 'duplicate_lesson' }));
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useUpdateAttendance(), { wrapper });

    await expect(
      result.current.mutateAsync({ id: 'a1', data: { status: 'absent' } }),
    ).rejects.toBeInstanceOf(AxiosError);
    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe('useApproveExcuse (EXC)', () => {
  const keysOf = (spy: ReturnType<typeof setup>['invalidate']) =>
    spy.mock.calls.map((c) => (c[0] as { queryKey: unknown[] }).queryKey);

  it('tana AYNAN {reason} (kesilgan) — fromDate/toDate yo‘q; kalitlar + opts.onSettled', async () => {
    h.putJson.mockResolvedValueOnce({ message: 'Sabab tasdiqlandi' });
    const onSettled = vi.fn();
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useApproveExcuse({ onSettled }), { wrapper });

    await result.current.mutateAsync({ id: 'a1', reason: '  Kasallik  ' });
    expect(h.putJson).toHaveBeenCalledWith('/attendance/a1/approve-excuse', { reason: 'Kasallik' });
    expect(keysOf(invalidate)).toEqual([[ATT_KEY], [RES_KEY], ['residency-assessments']]);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('xatoda ham (409/400) keshlar yangilanadi — qator o‘zgargan bo‘lishi mumkin', async () => {
    const err = httpError(409, { reason: 'session_row_not_absent' });
    h.putJson.mockRejectedValueOnce(err);
    const onSettled = vi.fn();
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useApproveExcuse({ onSettled }), { wrapper });

    await expect(result.current.mutateAsync({ id: 'a1', reason: 'Kasallik' })).rejects.toBe(err);
    expect(keysOf(invalidate)).toEqual([[ATT_KEY], [RES_KEY], ['residency-assessments']]);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });
});
