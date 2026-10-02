import { AxiosError } from 'axios';
import { getApiErrorMessage } from '@/shared/api';

export const ATTENDANCE_STATE_CHANGED_TEXT =
  'Yozuv shu orada o‘zgardi — sahifani yangilab, qayta urinib ko‘ring';

const reasonOf = (e: AxiosError): unknown => {
  const data: unknown = e.response?.data;
  return typeof data === 'object' && data !== null ? (data as { reason?: unknown }).reason : null;
};

export const isAttendanceStateChanged = (e: unknown): boolean =>
  e instanceof AxiosError && e.response?.status === 409 && reasonOf(e) === 'state_changed';

export const attendanceUpdateErrorText = (e: unknown): string =>
  isAttendanceStateChanged(e)
    ? ATTENDANCE_STATE_CHANGED_TEXT
    : getApiErrorMessage(e, 'Davomatni yangilashda xatolik');

export const EXCUSE_ERROR_TEXT = {
  notAbsent: 'Bu dars endi «Kelmadi» holatida emas — jadval yangilandi',
  forbidden: 'Sababli qilish huquqingiz yo‘q',
  notFound: 'Yozuv topilmadi — sahifani yangilang',
} as const;

const statusOf = (e: unknown): number | undefined =>
  e instanceof AxiosError ? e.response?.status : undefined;

export const isExcuseRowNotAbsent = (e: unknown): boolean =>
  e instanceof AxiosError && e.response?.status === 409 && reasonOf(e) === 'session_row_not_absent';

export const attendanceExcuseErrorText = (e: unknown): string => {
  if (isExcuseRowNotAbsent(e)) return EXCUSE_ERROR_TEXT.notAbsent;
  const status = statusOf(e);
  if (status === 403) return EXCUSE_ERROR_TEXT.forbidden;
  if (status === 404) return EXCUSE_ERROR_TEXT.notFound;
  return getApiErrorMessage(e, 'Sababni tasdiqlashda xatolik');
};

export const excuseErrorClosesModal = (e: unknown): boolean =>
  isExcuseRowNotAbsent(e) || statusOf(e) === 404;
