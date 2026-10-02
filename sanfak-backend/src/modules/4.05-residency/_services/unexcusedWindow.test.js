"use strict";

const {
  START_MONTH,
  currentAcademicYearTitle,
  currentAcademicYearWindow,
  unexcusedDateFilter,
  sumUnexcusedHours,
} = require("./unexcusedWindow");

const at = (iso) => new Date(iso);

describe("currentAcademicYearTitle — sanadan titul", () => {
  test("o'quv yili sentabrda boshlanadi", () => {
    expect(START_MONTH).toBe(9);
  });

  test("sentabr — YANGI yil boshlanadi", () => {
    expect(currentAcademicYearTitle(at("2026-09-01T00:00:00Z"))).toBe("2026/2027");
    expect(currentAcademicYearTitle(at("2026-09-24T10:00:00Z"))).toBe("2026/2027");
    expect(currentAcademicYearTitle(at("2026-12-31T23:59:59Z"))).toBe("2026/2027");
  });

  test("yanvar–avgust — O'TGAN kalendar yildan boshlangan o'quv yili", () => {
    expect(currentAcademicYearTitle(at("2027-01-01T00:00:00Z"))).toBe("2026/2027");
    expect(currentAcademicYearTitle(at("2027-08-31T23:59:59Z"))).toBe("2026/2027");
  });

  test("titul SLASH bilan — `academicYearRange` regexi ikkalasini biladi", () => {
    expect(currentAcademicYearTitle(at("2026-10-01T00:00:00Z"))).toMatch(
      /^\d{4}\/\d{4}$/,
    );
  });
});

describe("currentAcademicYearWindow — chegara kesimi", () => {
  test("oyna 1-sentabr 00:00:00Z dan boshlanadi", () => {
    const { from } = currentAcademicYearWindow(at("2026-09-24T10:00:00Z"));
    expect(from.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  test("oyna 31-avgust 23:59:59Z da tugaydi", () => {
    const { to } = currentAcademicYearWindow(at("2026-09-24T10:00:00Z"));
    expect(to.toISOString()).toBe("2027-08-31T23:59:59.000Z");
  });

  test("31-avgust ESKI yilga tushadi", () => {
    const { from, to } = currentAcademicYearWindow(at("2026-08-31T23:59:59Z"));
    expect(from.toISOString()).toBe("2025-09-01T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-08-31T23:59:59.000Z");
  });

  test("1-sentabr YANGI yilga tushadi", () => {
    const { from } = currentAcademicYearWindow(at("2026-09-01T00:00:00Z"));
    expect(from.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  test("oyna har doim oldinga yo'nalgan", () => {
    for (const iso of [
      "2026-09-01T00:00:00Z",
      "2027-01-15T00:00:00Z",
      "2027-08-31T00:00:00Z",
    ]) {
      const { from, to } = currentAcademicYearWindow(at(iso));
      expect(from.getTime()).toBeLessThan(to.getTime());
    }
  });

  test("oyna «oxirgi 12 oy» fallback'iga TUSHMAYDI", () => {
    const now = at("2027-03-15T12:34:56Z");
    const { from, to } = currentAcademicYearWindow(now);
    expect(to.getTime()).not.toBe(now.getTime());
    expect(from.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });
});

describe("unexcusedDateFilter — `Attendance.find` sharti", () => {
  test("`$gte`/`$lte` Date juftligi", () => {
    const f = unexcusedDateFilter(at("2026-09-24T10:00:00Z"));
    expect(Object.keys(f).sort()).toEqual(["$gte", "$lte"]);
    expect(f.$gte).toBeInstanceOf(Date);
    expect(f.$lte).toBeInstanceOf(Date);
  });

  test("oyna bilan bir xil chegaralar", () => {
    const now = at("2026-11-05T00:00:00Z");
    const { from, to } = currentAcademicYearWindow(now);
    const f = unexcusedDateFilter(now);
    expect(f.$gte.getTime()).toBe(from.getTime());
    expect(f.$lte.getTime()).toBe(to.getTime());
  });

  test("o'tgan o'quv yili sanasi oynadan TASHQARIDA", () => {
    const f = unexcusedDateFilter(at("2026-09-24T00:00:00Z"));
    const lastYear = at("2026-03-15T00:00:00Z");
    expect(lastYear.getTime()).toBeLessThan(f.$gte.getTime());
  });

  test("joriy yil sanasi oyna ICHIDA", () => {
    const f = unexcusedDateFilter(at("2026-09-24T00:00:00Z"));
    const thisYear = at("2026-09-10T00:00:00Z");
    expect(thisYear.getTime()).toBeGreaterThanOrEqual(f.$gte.getTime());
    expect(thisYear.getTime()).toBeLessThanOrEqual(f.$lte.getTime());
  });
});

describe("sumUnexcusedHours — `hours || 2` qoidasi", () => {
  test("soatlar yig'indisi", () => {
    expect(sumUnexcusedHours([{ hours: 2 }, { hours: 4 }, { hours: 1.5 }])).toBe(7.5);
  });

  test.each([[null], [undefined], [0], [NaN]])("bo'sh soat (%p) — 2 soat", (hours) => {
    expect(sumUnexcusedHours([{ hours }])).toBe(2);
  });

  test("bo'sh ro'yxat — 0", () => {
    expect(sumUnexcusedHours([])).toBe(0);
  });

  test("`expulsionCheck.sumUnexcusedHours` — AYNAN shu funksiya (ikkinchi nusxa yo'q)", () => {
    expect(require("./expulsionCheck").sumUnexcusedHours).toBe(sumUnexcusedHours);
  });
});
