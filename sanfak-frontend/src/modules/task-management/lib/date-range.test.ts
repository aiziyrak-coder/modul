import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import {
  currentMonthRange,
  currentMonthRangeIso,
  displayToIso,
  isSameIsoRange,
  isSameRange,
  parseUrlDate,
  parseUrlDateIso,
  RANGE_DISPLAY_FORMAT,
  toIsoDay,
  utcDayEnd,
  utcDayStart,
} from './date-range';

describe('date-range — UTC chegaralari', () => {
  it("kun boshi/oxiri UTC'da hosil qilinadi (mahalliy mintaqa surmaydi)", () => {
    const d = dayjs('2026-08-15');
    expect(utcDayStart(d)).toBe('2026-08-15T00:00:00.000Z');
    expect(utcDayEnd(d)).toBe('2026-08-15T23:59:59.999Z');
  });

  it("backend saqlagan muddat (UTC yarim tun) chegaralar ICHIDA qoladi", () => {
    const from = new Date(utcDayStart(dayjs('2026-08-01'))).getTime();
    const to = new Date(utcDayEnd(dayjs('2026-08-31'))).getTime();

    const firstDay = Date.parse('2026-08-01T00:00:00.000Z');
    const lastDay = Date.parse('2026-08-31T00:00:00.000Z');
    expect(firstDay).toBeGreaterThanOrEqual(from);
    expect(lastDay).toBeLessThanOrEqual(to);

    expect(Date.parse('2026-07-31T00:00:00.000Z')).toBeLessThan(from);
    expect(Date.parse('2026-09-01T00:00:00.000Z')).toBeGreaterThan(to);
  });
});

describe('date-range — joriy oy', () => {
  it('1-sanadan oxirgi kungacha, chegaralar inclusive', () => {
    const [from, to] = currentMonthRange();
    const now = dayjs();
    expect(from.date()).toBe(1);
    expect(from.month()).toBe(now.month());
    expect(from.year()).toBe(now.year());
    expect(to.date()).toBe(now.daysInMonth());
    expect(to.month()).toBe(now.month());
  });
});

describe('date-range — URL query', () => {
  it("`YYYY-MM-DD` ham, to'liq ISO ham bir xil kalendar kunini beradi", () => {
    const plain = parseUrlDate('2026-08-01');
    const iso = parseUrlDate('2026-08-01T00:00:00.000Z');
    expect(plain?.date()).toBe(1);
    expect(plain?.month()).toBe(7);
    expect(plain?.year()).toBe(2026);
    expect(iso?.isSame(plain!, 'day')).toBe(true);
  });

  it("bo'sh yoki buzuq qiymat `null` qaytaradi (default oy ishlaydi)", () => {
    expect(parseUrlDate(null)).toBeNull();
    expect(parseUrlDate('')).toBeNull();
    expect(parseUrlDate('salom')).toBeNull();
  });
});

describe('date-range — default bilan taqqoslash', () => {
  it('joriy oy = default → "faol filtr" emas', () => {
    expect(isSameRange(currentMonthRange(), currentMonthRange())).toBe(true);
  });

  it("boshqa oraliq yoki bo'sh qiymat → faol filtr", () => {
    const def = currentMonthRange();
    expect(isSameRange([dayjs('2020-01-01'), dayjs('2020-01-31')], def)).toBe(false);
    expect(isSameRange(null, def)).toBe(false);
    expect(isSameRange([def[0], null], def)).toBe(false);
  });
});

describe("date-range — satrli (ISO) variantlar", () => {
  it("`toIsoDay` MAHALLIY kalendar kunini beradi (mintaqa surmaydi)", () => {
    expect(toIsoDay(dayjs('2026-08-01'))).toBe('2026-08-01');
    expect(toIsoDay(dayjs('2026-08-31').endOf('month'))).toBe('2026-08-31');
  });

  it("`currentMonthRangeIso` — dayjs varianti bilan AYNI oraliq", () => {
    const [from, to] = currentMonthRange();
    expect(currentMonthRangeIso()).toEqual([toIsoDay(from), toIsoDay(to)]);
  });

  it("`parseUrlDateIso` ikkala URL shaklini bir xil ISO kunga keltiradi", () => {
    expect(parseUrlDateIso('2026-08-01')).toBe('2026-08-01');
    expect(parseUrlDateIso('2026-08-01T00:00:00.000Z')).toBe('2026-08-01');
    expect(parseUrlDateIso(null)).toBeNull();
    expect(parseUrlDateIso('')).toBeNull();
    expect(parseUrlDateIso('salom')).toBeNull();
  });

  it("`displayToIso` RangePicker ekran formatini (`DD.MM.YYYY`) ISO qiladi", () => {
    expect(RANGE_DISPLAY_FORMAT).toBe('DD.MM.YYYY');
    expect(displayToIso('01.08.2026')).toBe('2026-08-01');
    expect(displayToIso('31.12.2026')).toBe('2026-12-31');
  });

  it("`displayToIso` ISO kelsa ham buzmaydi, buzuq/bo'sh qiymatda `null`", () => {
    expect(displayToIso('2026-08-01')).toBe('2026-08-01');
    expect(displayToIso('2026-08-01T00:00:00.000Z')).toBe('2026-08-01');
    expect(displayToIso('')).toBeNull();
    expect(displayToIso(null)).toBeNull();
    expect(displayToIso(undefined)).toBeNull();
    expect(displayToIso('salom')).toBeNull();
  });

  it("`isSameIsoRange` — default oy bilan solishtirish", () => {
    const def = currentMonthRangeIso();
    expect(isSameIsoRange(def, def)).toBe(true);
    expect(isSameIsoRange(['2020-01-01', '2020-01-31'], def)).toBe(false);
    expect(isSameIsoRange(null, def)).toBe(false);
    expect(isSameIsoRange(['', ''], def)).toBe(false);
  });
});

describe("date-range — satr↔dayjs ko'prigi API parametrlarini o'zgartirmaydi", () => {
  it("satrdan qayta qurilgan chegara Dayjs varianti bilan BAYT-BA-BAYT bir xil", () => {
    const picked: [dayjs.Dayjs, dayjs.Dayjs] = [dayjs('2026-08-01'), dayjs('2026-08-31')];
    const iso: [string, string] = [toIsoDay(picked[0]), toIsoDay(picked[1])];

    expect(utcDayStart(dayjs(iso[0]))).toBe(utcDayStart(picked[0]));
    expect(utcDayEnd(dayjs(iso[1]))).toBe(utcDayEnd(picked[1]));
    expect(utcDayStart(dayjs(iso[0]))).toBe('2026-08-01T00:00:00.000Z');
    expect(utcDayEnd(dayjs(iso[1]))).toBe('2026-08-31T23:59:59.999Z');
  });

  it("RangePicker ekran satridan kelgan oraliq ham aynan shu chegarani beradi", () => {
    const from = displayToIso('01.08.2026');
    const to = displayToIso('31.08.2026');
    expect(utcDayStart(dayjs(from!))).toBe('2026-08-01T00:00:00.000Z');
    expect(utcDayEnd(dayjs(to!))).toBe('2026-08-31T23:59:59.999Z');
  });

  it("URL query'dan kelgan oraliq ham eski (Dayjs) yo'l bilan bir xil", () => {
    const legacy = parseUrlDate('2026-08-01T00:00:00.000Z');
    const next = parseUrlDateIso('2026-08-01T00:00:00.000Z');
    expect(utcDayStart(dayjs(next!))).toBe(utcDayStart(legacy!));
  });
});
