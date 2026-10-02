import type { SeasonName, SeasonStatus } from '../model/admission-types';

export const SEASON_ORDER: SeasonName[] = ['bahor', 'yoz', 'kuz', 'qish'];

export const SEASON_META: Record<SeasonName, { titleKey: string; color: string }> = {
  bahor: { titleKey: 'foreignAdmission.season.bahor', color: 'green' },
  yoz: { titleKey: 'foreignAdmission.season.yoz', color: 'orange' },
  kuz: { titleKey: 'foreignAdmission.season.kuz', color: 'volcano' },
  qish: { titleKey: 'foreignAdmission.season.qish', color: 'blue' },
};

export const SEASON_STATUS_ORDER: SeasonStatus[] = ['rejada', 'ochiq', 'yopiq'];

export const SEASON_STATUS_META: Record<SeasonStatus, { titleKey: string; color: string }> = {
  rejada: { titleKey: 'foreignAdmission.seasonStatus.rejada', color: 'blue' },
  ochiq: { titleKey: 'foreignAdmission.seasonStatus.ochiq', color: 'green' },
  yopiq: { titleKey: 'foreignAdmission.seasonStatus.yopiq', color: 'default' },
};

export const isSeasonEditable = (status: SeasonStatus): boolean => status !== 'yopiq';

export const ACADEMIC_YEAR_PATTERN = /^\d{4}\/\d{4}$/;

export const isValidAcademicYear = (value: string): boolean =>
  ACADEMIC_YEAR_PATTERN.test(value.trim());
