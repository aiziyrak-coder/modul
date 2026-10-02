"use strict";

const fs = require("fs");

const mockSeen = {};
const mockRows = { attendance: [], dailyLog: [], assessment: [] };
const mockFind = (name, filter) => {
  mockSeen[name] = filter;
  return { select: () => ({ lean: () => Promise.resolve(mockRows[name]) }) };
};

jest.mock("#modules/4.05-residency/attendance/attendance.model", () => ({
  find: (f) => mockFind("attendance", f),
}));
jest.mock("#modules/4.05-residency/dailyLog/dailyLog.model", () => ({
  find: (f) => mockFind("dailyLog", f),
}));
jest.mock("#modules/4.05-residency/assessment/assessment.model", () => ({
  find: (f) => mockFind("assessment", f),
}));

const { checkAttestationEligibility } = require("./attestationCheck");

const RES = "6a5a0acbd34b3c21a575d5fb";
const NOW = new Date("2026-10-02T07:00:00Z");
const Y_FROM = new Date("2026-09-01T00:00:00.000Z");
const Y_TO = new Date("2027-08-31T23:59:59.000Z");

beforeEach(() => {
  for (const k of Object.keys(mockSeen)) delete mockSeen[k];
  mockRows.attendance = [];
  mockRows.dailyLog = [];
  mockRows.assessment = [];
});

describe("ATW-Q1 — sanasiz so'rov: joriy o'quv yili", () => {
  it("davomat filtri aynan o'quv yili oynasi", async () => {
    await checkAttestationEligibility(RES, { now: NOW });
    expect(mockSeen.attendance).toEqual({
      resident: RES,
      active: true,
      date: { $gte: Y_FROM, $lte: Y_TO },
    });
  });

  it("javobda `window` — manba, titul va chegaralar", async () => {
    const r = await checkAttestationEligibility(RES, { now: NOW });
    expect(r.details.attendance.window).toEqual({
      source: "academicYear",
      academicYear: "2026/2027",
      from: Y_FROM,
      to: Y_TO,
    });
  });

  it("JSON'da sanalar ISO satr bo'lib chiqadi", async () => {
    const r = await checkAttestationEligibility(RES, { now: NOW });
    const w = JSON.parse(JSON.stringify(r)).details.attendance.window;
    expect(w.from).toBe("2026-09-01T00:00:00.000Z");
    expect(w.to).toBe("2027-08-31T23:59:59.000Z");
  });
});

describe("ATW-Q3 — kundalik va baholar sanasiz qoladi", () => {
  it("sanasiz so'rovda kundalik filtrida `date` YO'Q", async () => {
    await checkAttestationEligibility(RES, { now: NOW });
    expect(mockSeen.dailyLog).toEqual({ resident: RES, active: true });
    expect(mockSeen.dailyLog).not.toHaveProperty("date");
  });

  it("baholarda sana umuman yo'q (aniq sana berilsa ham)", async () => {
    await checkAttestationEligibility(RES, { fromDate: "2024-01-01", now: NOW });
    expect(mockSeen.assessment).not.toHaveProperty("date");
  });
});

describe("ATW-Q6 — yil chegarasi (titul va oyna bitta `now` dan)", () => {
  it("31-avgust 23:59:59Z — hali ESKI yil", async () => {
    const now = new Date("2026-08-31T23:59:59Z");
    const r = await checkAttestationEligibility(RES, { now });
    expect(r.details.attendance.window.academicYear).toBe("2025/2026");
    expect(mockSeen.attendance.date).toEqual({
      $gte: new Date("2025-09-01T00:00:00.000Z"),
      $lte: new Date("2026-08-31T23:59:59.000Z"),
    });
  });

  it("1-sentabr 00:00:00Z — YANGI yil", async () => {
    const now = new Date("2026-09-01T00:00:00Z");
    const r = await checkAttestationEligibility(RES, { now });
    expect(r.details.attendance.window.academicYear).toBe("2026/2027");
    expect(mockSeen.attendance.date).toEqual({ $gte: Y_FROM, $lte: Y_TO });
  });

  it("uzoq sana — titul bugungi soatdan EMAS, `now` dan", async () => {
    const r = await checkAttestationEligibility(RES, { now: new Date("2030-01-15T12:00:00Z") });
    expect(r.details.attendance.window.academicYear).toBe("2029/2030");
    expect(r.details.attendance.window.from).toEqual(new Date("2029-09-01T00:00:00.000Z"));
  });
});

describe("ATW-Q2 — aniq sana bugungidek", () => {
  const FROM = new Date("2024-01-01T00:00:00.000Z");
  const TO = new Date("2024-06-30T00:00:00.000Z");

  it("from+to — davomat va kundalik AYNAN shu oraliq, o'quv yili bilan kesishmaydi", async () => {
    const r = await checkAttestationEligibility(RES, { fromDate: FROM, toDate: TO, now: NOW });
    expect(mockSeen.attendance.date).toEqual({ $gte: FROM, $lte: TO });
    expect(mockSeen.dailyLog.date).toEqual({ $gte: FROM, $lte: TO });
    expect(r.details.attendance.window).toEqual({
      source: "explicit",
      academicYear: null,
      from: FROM,
      to: TO,
    });
  });

  it("faqat toDate — `$gte` YO'Q (pastki chegara ochiq)", async () => {
    const r = await checkAttestationEligibility(RES, { toDate: TO, now: NOW });
    expect(mockSeen.attendance.date).toEqual({ $lte: TO });
    expect(mockSeen.dailyLog.date).toEqual({ $lte: TO });
    expect(r.details.attendance.window.from).toBeNull();
  });

  it("faqat fromDate — `$lte` YO'Q (o'quv yilidan to'ldirilmaydi)", async () => {
    const r = await checkAttestationEligibility(RES, { fromDate: FROM, now: NOW });
    expect(mockSeen.attendance.date).toEqual({ $gte: FROM });
    expect(mockSeen.dailyLog.date).toEqual({ $gte: FROM });
    expect(r.details.attendance.window).toMatchObject({ source: "explicit", to: null });
  });
});

describe("ATW-Q4/Q5 — sababsiz qoidasi va javob shakli", () => {
  const rows = () => [
    { status: "absent", hours: 4 },
    { status: "absent", hours: null },
    { status: "absent", hours: 2, excuseApprovedBy: "u1" },
    { status: "excused", hours: 6 },
    { status: "present", hours: 2 },
  ];

  it("sababsiz 6, jami qoldirilgan 8, kelgan 2", async () => {
    mockRows.attendance = rows();
    const { attendance } = (await checkAttestationEligibility(RES, { now: NOW })).details;
    expect(attendance).toMatchObject({
      totalRecords: 5,
      unexcusedHours: 6,
      totalAbsentHours: 8,
      totalAttendedHours: 2,
    });
  });

  it("eski kalitlar joyida, 6 soat sababi matni o'zgarmagan", async () => {
    mockRows.attendance = rows();
    mockRows.assessment = [{ type: "oraliq", score: 80, maxScore: 100 }];
    const r = await checkAttestationEligibility(RES, { now: NOW });
    expect(Object.keys(r).sort()).toEqual(
      ["details", "eligible", "expulsionTriggered", "reasons", "warningTriggered"],
    );
    expect(Object.keys(r.details).sort()).toEqual(["assessment", "attendance", "dailyLog"]);
    expect(r.reasons).toEqual(["Sababsiz qoldirilgan soatlar 6 — ogohlantirish (6+ soat)"]);
    expect(r).toMatchObject({ eligible: true, warningTriggered: true, expulsionTriggered: false });
  });
});

describe("`now` berilmasa — tizim soati", () => {
  afterEach(() => jest.useRealTimers());

  it("soat 2027-03-15 -> 2026/2027", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2027-03-15T10:00:00Z"));
    const r = await checkAttestationEligibility(RES);
    expect(r.details.attendance.window.academicYear).toBe("2026/2027");
    expect(mockSeen.attendance.date).toEqual({ $gte: Y_FROM, $lte: Y_TO });
  });

  it("soat 2026-08-31 23:59:59Z -> 2025/2026", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-31T23:59:59Z"));
    const r = await checkAttestationEligibility(RES);
    expect(r.details.attendance.window.academicYear).toBe("2025/2026");
  });
});

describe("wiring — chegara ikkinchi marta yozilmaydi", () => {
  it("`unexcusedWindow` dan oladi, o'z sana arifmetikasi yo'q", () => {
    const src = fs.readFileSync(require.resolve("./attestationCheck"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/.*$/gm, "$1");
    expect(code).toMatch(/require\("\.\/unexcusedWindow"\)/);
    expect(code).not.toMatch(/Date\.UTC\(/);
    expect(code).not.toMatch(/getUTCMonth/);
  });
});
