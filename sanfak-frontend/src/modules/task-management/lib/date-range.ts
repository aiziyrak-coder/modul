import dayjs from 'dayjs';

export type DateRange = [dayjs.Dayjs, dayjs.Dayjs];
export type PartialDateRange = [dayjs.Dayjs | null, dayjs.Dayjs | null] | null;

export const utcDayStart = (d: dayjs.Dayjs): string =>
  new Date(Date.UTC(d.year(), d.month(), d.date(), 0, 0, 0, 0)).toISOString();

export const utcDayEnd = (d: dayjs.Dayjs): string =>
  new Date(Date.UTC(d.year(), d.month(), d.date(), 23, 59, 59, 999)).toISOString();

export const currentMonthRange = (): DateRange => {
  const now = dayjs();
  return [now.startOf('month'), now.endOf('month')];
};

export const parseUrlDate = (raw: string | null): dayjs.Dayjs | null => {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return dayjs(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

export const isSameRange = (a: PartialDateRange, b: DateRange): boolean =>
  !!a?.[0] && !!a?.[1] && a[0].isSame(b[0], 'day') && a[1].isSame(b[1], 'day');

export type IsoDate = string;
export type IsoDateRange = [IsoDate, IsoDate];
export type PartialIsoDateRange = IsoDateRange | null;

export const RANGE_DISPLAY_FORMAT = 'DD.MM.YYYY';

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})/;
const DISPLAY_DAY = /^(\d{2})\.(\d{2})\.(\d{4})$/;

export const toIsoDay = (d: dayjs.Dayjs): IsoDate => d.format('YYYY-MM-DD');

export const displayToIso = (raw: string | null | undefined): IsoDate | null => {
  if (!raw) return null;
  const iso = ISO_DAY.exec(raw);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const disp = DISPLAY_DAY.exec(raw);
  if (disp) return `${disp[3]}-${disp[2]}-${disp[1]}`;
  return null;
};

export const currentMonthRangeIso = (): IsoDateRange => {
  const [from, to] = currentMonthRange();
  return [toIsoDay(from), toIsoDay(to)];
};

export const parseUrlDateIso = (raw: string | null): IsoDate | null => {
  const d = parseUrlDate(raw);
  return d ? toIsoDay(d) : null;
};

export const isSameIsoRange = (a: PartialIsoDateRange, b: IsoDateRange): boolean =>
  !!a?.[0] && !!a?.[1] && a[0] === b[0] && a[1] === b[1];
