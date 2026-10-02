"use strict";

const chain = (rows) => ({ select: () => ({ lean: () => Promise.resolve(rows) }) });

let attendanceRows = [];
let dailyLogRows = [];
let assessmentRows = [];

jest.mock("#modules/4.05-residency/attendance/attendance.model", () => ({
  find: () => chainRef.attendance(),
}));
jest.mock("#modules/4.05-residency/dailyLog/dailyLog.model", () => ({
  find: () => chainRef.dailyLog(),
}));
jest.mock("#modules/4.05-residency/assessment/assessment.model", () => ({
  find: () => chainRef.assessment(),
}));

const chainRef = {
  attendance: () => chain(attendanceRows),
  dailyLog: () => chain(dailyLogRows),
  assessment: () => chain(assessmentRows),
};

const { checkAttestationEligibility } = require("./attestationCheck");

const RES = "6a5a0acbd34b3c21a575d5fb";

beforeEach(() => {
  attendanceRows = [];
  dailyLogRows = [];
  assessmentRows = [];
});

describe("qo'yilgan ball talabi", () => {
  it("BAHOLANGAN oraliq bo'lsa — ruxsat bor", async () => {
    assessmentRows = [{ type: "oraliq", score: 75, maxScore: 100 }];
    const r = await checkAttestationEligibility(RES);
    expect(r.eligible).toBe(true);
    expect(r.details.assessment.interimCount).toBe(1);
  });

  it("faqat REJALASHTIRILGAN oraliq (ball yo'q) — ruxsat YO'Q", async () => {
    assessmentRows = [{ type: "oraliq", maxScore: 100 }];
    const r = await checkAttestationEligibility(RES);
    expect(r.eligible).toBe(false);
    expect(r.details.assessment.interimCount).toBe(0);
    expect(r.reasons.join(" ")).toContain("oraliq");
  });

  it("score: null ham baholanmagan deb sanaladi", async () => {
    assessmentRows = [{ type: "oraliq", score: null, maxScore: 100 }];
    const r = await checkAttestationEligibility(RES);
    expect(r.details.assessment.interimCount).toBe(0);
  });

  it("0 ball — QO'YILGAN ball (baholanmagan EMAS)", async () => {
    assessmentRows = [{ type: "oraliq", score: 0, maxScore: 100 }];
    const r = await checkAttestationEligibility(RES);
    expect(r.details.assessment.interimCount).toBe(1);
    expect(r.eligible).toBe(true);
  });
});

describe("o'rtacha ball NaN bo'lmaydi", () => {
  it("baholanmagan yozuv o'rtachani buzmaydi", async () => {
    assessmentRows = [
      { type: "oraliq", maxScore: 100 },
      { type: "oraliq", score: 80, maxScore: 100 },
    ];
    const r = await checkAttestationEligibility(RES);
    expect(Number.isNaN(r.details.assessment.avgScore)).toBe(false);
    expect(r.details.assessment.avgScore).toBe(80);
    expect(JSON.parse(JSON.stringify(r)).details.assessment.avgScore).toBe(80);
  });

  it("maxScore boshqa bo'lsa foizga keltiriladi", async () => {
    assessmentRows = [{ type: "oraliq", score: 25, maxScore: 50 }];
    const r = await checkAttestationEligibility(RES);
    expect(r.details.assessment.avgScore).toBe(50);
  });
});

describe("TZ 4.5.6 jamlanmasi (byType)", () => {
  it("dars mashg'uloti, sinov testi va amaliy — uchalasi ham jamlanadi", async () => {
    assessmentRows = [
      { type: "oraliq", score: 80, maxScore: 100 },
      { type: "oraliq", score: 60, maxScore: 100 },
      { type: "test", score: 90, maxScore: 100 },
      { type: "amaliy", score: 40, maxScore: 50 },
    ];
    const { byType } = (await checkAttestationEligibility(RES)).details.assessment;
    expect(byType.oraliq).toEqual({ count: 2, avgScore: 70 });
    expect(byType.test).toEqual({ count: 1, avgScore: 90 });
    expect(byType.amaliy).toEqual({ count: 1, avgScore: 80 });
  });

  it("bo'sh tur -> count 0, avgScore null", async () => {
    assessmentRows = [{ type: "oraliq", score: 80, maxScore: 100 }];
    const { byType } = (await checkAttestationEligibility(RES)).details.assessment;
    expect(byType.test).toEqual({ count: 0, avgScore: null });
  });

  it("baholanmagan sinov jamlanmaga kirmaydi", async () => {
    assessmentRows = [
      { type: "oraliq", score: 80, maxScore: 100 },
      { type: "test", maxScore: 100 },
    ];
    const { byType } = (await checkAttestationEligibility(RES)).details.assessment;
    expect(byType.test.count).toBe(0);
  });

  it("sinov testi ruxsat shartiga TA'SIR QILMAYDI", async () => {
    assessmentRows = [{ type: "test", score: 95, maxScore: 100 }];
    const r = await checkAttestationEligibility(RES);
    expect(r.eligible).toBe(false);
  });
});

describe("davomat va kundalik shartlari saqlanadi", () => {
  it("72+ sababsiz soat -> chetlatish chegarasi", async () => {
    attendanceRows = Array.from({ length: 40 }, () => ({ status: "absent", hours: 2 }));
    assessmentRows = [{ type: "oraliq", score: 80, maxScore: 100 }];
    const r = await checkAttestationEligibility(RES);
    expect(r.expulsionTriggered).toBe(true);
    expect(r.eligible).toBe(false);
  });

  it("kundalik tasdig'i 70% dan past -> ruxsat yo'q", async () => {
    dailyLogRows = [
      { supervisorApproved: true },
      { supervisorApproved: false },
      { supervisorApproved: false },
    ];
    assessmentRows = [{ type: "oraliq", score: 80, maxScore: 100 }];
    const r = await checkAttestationEligibility(RES);
    expect(r.eligible).toBe(false);
  });
});
