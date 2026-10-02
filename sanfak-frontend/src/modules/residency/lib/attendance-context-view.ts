import { sessionErrorInfo } from '../api/session-api';
import type { AttendanceContext } from '../api/attendance-context';
import type { SessionState } from '../api/session-types';
import type { Program } from '../api/types';

export const isAttendanceTracked = (program: Program | null): boolean => program !== 'magistratura';

export type ContextNotice = 'loading' | 'forbidden' | 'notFound' | 'error' | 'ok';

export interface ContextQueryState {
  isPending: boolean;
  isError: boolean;
  error: unknown;
}

export function contextNotice(q: ContextQueryState): ContextNotice {
  if (q.isError) {
    const info = sessionErrorInfo(q.error, '');
    if (info.status === 403) return 'forbidden';
    if (info.status === 404 && info.reason === 'resident_not_found') return 'notFound';
    return 'error';
  }
  return q.isPending ? 'loading' : 'ok';
}

export const SESSION_COUNT_ORDER: readonly SessionState[] = [
  'present',
  'absent',
  'excused',
  'unmeasured',
  'pending',
];

const percentOf = (ctx: AttendanceContext): number | null => {
  const c = ctx.coverage;
  if (!c || c.ratio === null || c.denominator === 0) return null;
  return Math.round(c.ratio * 100);
};

export function coverageText(ctx: AttendanceContext): string {
  const pct = percentOf(ctx);
  if (pct === null || !ctx.coverage) return '—';
  return `${pct}% (${ctx.coverage.measured} / ${ctx.coverage.denominator})`;
}

export function contextTitle(ctx: AttendanceContext | undefined): string {
  const base = 'Davomat — joriy o‘quv yili';
  return ctx?.academicYear ? `${base} (${ctx.academicYear})` : base;
}

export const unexcusedHoursText = (ctx: AttendanceContext): string =>
  ctx.unexcusedHours === null ? '—' : `${ctx.unexcusedHours} soat`;

export function compactSummary(ctx: AttendanceContext): string {
  const year = ctx.academicYear ?? 'joriy o‘quv yili';
  const hours =
    ctx.unexcusedHours === null ? 'sababsiz soat —' : `sababsiz ${ctx.unexcusedHours} soat`;
  const parts = [hours];
  if (ctx.warningIssued) parts.push('ogohlantirish berilgan');
  if (ctx.expulsionOrderCreated) parts.push('chetlatish loyihasi ochilgan');
  const pct = percentOf(ctx);
  parts.push(pct === null ? 'qamrov —' : `qamrov ${pct}%`);
  return `Davomat (${year}): ${parts.join(' · ')}`;
}
