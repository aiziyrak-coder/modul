import type { TFunction } from 'i18next';

export interface MinHourError {
  position?: string | null;
  stavka?: number | null;
  totalHour?: number | null;
  auditoriumHour?: number | null;
  minHour?: number | null;
  shortage?: number | null;
  message?: string | null;
}

interface ApiErrorLike {
  response?: { data?: { message?: string; errors?: MinHourError[] } };
}

export function buildMinHourErrorMessage(t: TFunction, err: unknown): string | null {
  const errors = (err as ApiErrorLike)?.response?.data?.errors;
  if (!Array.isArray(errors) || errors.length === 0) return null;

  const rows = errors.filter(
    (e) =>
      typeof e?.minHour === 'number' &&
      (typeof e?.auditoriumHour === 'number' || typeof e?.totalHour === 'number'),
  );
  if (rows.length === 0) return null;

  const detail = rows
    .map((e) => {
      const aud = typeof e.auditoriumHour === 'number' ? e.auditoriumHour : null;
      const basis = aud ?? e.totalHour ?? 0;
      const basisText =
        aud !== null ? t('studyLoad.distribution.minHour.auditoriumBasis', { value: aud }) : `${basis}`;
      const shortage =
        typeof e.shortage === 'number' ? e.shortage : (e.minHour ?? 0) - basis;
      const who = [
        e.position,
        e.stavka ? t('studyLoad.distribution.minHour.stavkaLabel', { stavka: e.stavka }) : null,
      ]
        .filter(Boolean)
        .join(' · ');
      return t('studyLoad.distribution.minHour.rowLine', {
        who: who || t('studyLoad.distribution.minHour.teacherFallback'),
        basis: basisText,
        minHour: e.minHour,
        shortage,
      });
    })
    .join('\n');

  return (
    t('studyLoad.distribution.minHour.summary', { n: rows.length, detail }) +
    '\n' +
    t('studyLoad.distribution.minHour.suggestion')
  );
}
