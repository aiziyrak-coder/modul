import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';
import type { AttendanceContext } from '../api/attendance-context';
import {
  SESSION_COUNT_ORDER,
  compactSummary,
  contextNotice,
  contextTitle,
  coverageText,
  isAttendanceTracked,
  unexcusedHoursText,
} from './attendance-context-view';

const httpError = (status: number, data: Record<string, unknown> = {}) =>
  new AxiosError('xato', 'ERR', undefined, undefined, {
    status,
    statusText: '',
    data,
    headers: {} as AxiosHeaders,
    config: { headers: new AxiosHeaders() },
  });

const ctx = (over: Partial<AttendanceContext> = {}): AttendanceContext => ({
  academicYear: '2026/2027',
  residentStatus: 'oquvda',
  unexcusedHours: 8,
  warningIssued: false,
  expulsionOrderCreated: false,
  sessions: { total: 8, present: 3, absent: 1, excused: 0, unmeasured: 2, pending: 2 },
  coverage: { measured: 4, denominator: 6, ratio: 4 / 6 },
  ...over,
});

const failed = (error: unknown) => ({ isPending: false, isError: true, error });

describe('contextNotice — so‘rov holati → panel holati', () => {
  it('403 → forbidden', () => {
    expect(contextNotice(failed(httpError(403, { reason: 'resident_out_of_scope' })))).toBe(
      'forbidden',
    );
  });

  it('404 + resident_not_found → notFound', () => {
    expect(contextNotice(failed(httpError(404, { reason: 'resident_not_found' })))).toBe(
      'notFound',
    );
  });

  it('sababsiz 404 (#301 siz eski backend route’i) → error', () => {
    expect(contextNotice(failed(httpError(404)))).toBe('error');
    expect(contextNotice(failed(httpError(404, { reason: 'session_not_found' })))).toBe('error');
  });

  it('500 va tarmoq xatosi → error', () => {
    expect(contextNotice(failed(httpError(500)))).toBe('error');
    expect(contextNotice(failed(new Error('Network Error')))).toBe('error');
  });

  it('kutilmoqda → loading; muvaffaqiyat → ok', () => {
    expect(contextNotice({ isPending: true, isError: false, error: null })).toBe('loading');
    expect(contextNotice({ isPending: false, isError: false, error: null })).toBe('ok');
  });
});

describe('isAttendanceTracked — GCX-Q4 (MAG-Q1=A)', () => {
  it('magistratura → kuzatilmaydi; ordinatura va noma’lum → so‘rov yuboriladi', () => {
    expect(isAttendanceTracked('magistratura')).toBe(false);
    expect(isAttendanceTracked('ordinatura')).toBe(true);
    expect(isAttendanceTracked(null)).toBe(true);
  });
});

describe('coverageText — rang ostonasi yo‘q, faqat raqam', () => {
  it('`67% (4 / 6)`', () => {
    expect(coverageText(ctx())).toBe('67% (4 / 6)');
  });

  it('ratio null / maxraj 0 / coverage yo‘q → `—`', () => {
    expect(coverageText(ctx({ coverage: { measured: 4, denominator: 6, ratio: null } }))).toBe('—');
    expect(coverageText(ctx({ coverage: { measured: 0, denominator: 0, ratio: 0 } }))).toBe('—');
    expect(coverageText(ctx({ coverage: null }))).toBe('—');
  });

  it('`0%` — haqiqiy qiymat', () => {
    expect(coverageText(ctx({ coverage: { measured: 0, denominator: 3, ratio: 0 } }))).toBe(
      '0% (0 / 3)',
    );
  });
});

describe('matnlar', () => {
  it('sarlavha o‘quv yilini aytadi (GCX-Q6)', () => {
    expect(contextTitle(ctx())).toBe('Davomat — joriy o‘quv yili (2026/2027)');
    expect(contextTitle(undefined)).toBe('Davomat — joriy o‘quv yili');
  });

  it('soat: `0 soat` haqiqiy, null → `—`', () => {
    expect(unexcusedHoursText(ctx({ unexcusedHours: 0 }))).toBe('0 soat');
    expect(unexcusedHoursText(ctx({ unexcusedHours: null }))).toBe('—');
  });

  it('natija tartibi — beshta holat', () => {
    expect(SESSION_COUNT_ORDER).toEqual(['present', 'absent', 'excused', 'unmeasured', 'pending']);
  });
});

describe('compactSummary — GradeModal bir qatori', () => {
  it('bayroqsiz', () => {
    expect(compactSummary(ctx())).toBe('Davomat (2026/2027): sababsiz 8 soat · qamrov 67%');
  });

  it('ikkala server bayrog‘i bilan', () => {
    expect(compactSummary(ctx({ warningIssued: true, expulsionOrderCreated: true }))).toBe(
      'Davomat (2026/2027): sababsiz 8 soat · ogohlantirish berilgan · ' +
        'chetlatish loyihasi ochilgan · qamrov 67%',
    );
  });

  it('bayroq FAQAT serverdan — 80 soat bo‘lsa ham FE o‘zi qo‘shmaydi (GCX-Q5)', () => {
    expect(compactSummary(ctx({ unexcusedHours: 80 }))).not.toMatch(/ogohlantirish|chetlatish/);
  });

  it('ma’lumot yetishmasa — `—`, o‘quv yili noma’lum', () => {
    expect(compactSummary(ctx({ academicYear: null, unexcusedHours: null, coverage: null }))).toBe(
      'Davomat (joriy o‘quv yili): sababsiz soat — · qamrov —',
    );
  });
});
