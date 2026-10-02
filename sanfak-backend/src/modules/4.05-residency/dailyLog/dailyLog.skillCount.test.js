"use strict";

const {
  createDailyLogSchema,
  updateDailyLogSchema,
} = require("./dailyLog.validation");
const DailyLog = require("./dailyLog.model");
const { SKILL_COUNT_MIN, SKILL_COUNT_MAX } = require("./dailyLog.model");

const RESIDENT = "6a5a0acbd34b3c21a575d59d";
const create = (count) =>
  createDailyLogSchema.validate(
    { resident: RESIDENT, date: "2026-03-02", skills: [{ skill: "Punksiya", count }] },
    { abortEarly: false },
  );
const update = (count) =>
  updateDailyLogSchema.validate(
    { skills: [{ skill: "Punksiya", count }] },
    { abortEarly: false },
  );

describe("createDailyLogSchema — skills[].count", () => {
  it("chegara qiymatlari QABUL qilinadi (0 va 1000)", () => {
    expect(create(SKILL_COUNT_MIN).error).toBeUndefined();
    expect(create(SKILL_COUNT_MAX).error).toBeUndefined();
  });

  it("chegaradan SAL tashqarisi RAD etiladi (-1 va 1001)", () => {
    expect(create(SKILL_COUNT_MIN - 1).error).toBeDefined();
    expect(create(SKILL_COUNT_MAX + 1).error).toBeDefined();
  });

  it("typo (3000000) RAD etiladi — progress hisobi buzilmaydi", () => {
    expect(create(3000000).error).toBeDefined();
  });

  it("\"\" hamon qabul qilinadi va kalit olib tashlanadi (D-074 regressiyasi yo'q)", () => {
    const { error, value } = create("");
    expect(error).toBeUndefined();
    expect(
      Object.prototype.hasOwnProperty.call(value.skills[0], "count"),
    ).toBe(false);
  });
});

describe("updateDailyLogSchema — skills[].count", () => {
  it("ESKI `count: 0` qatorlar tahrirlashda o'tadi (min(1) EMAS)", () => {
    expect(update(0).error).toBeUndefined();
  });

  it("chegaradan tashqarisi RAD etiladi (-1 va 1001)", () => {
    expect(update(-1).error).toBeDefined();
    expect(update(SKILL_COUNT_MAX + 1).error).toBeDefined();
  });
});

describe("Mongoose — SkillEntrySchema.count (Joi bilan bir xil chegara)", () => {
  const errFor = (count) =>
    new DailyLog({
      resident: "6a5a0acbd34b3c21a575d59d",
      date: new Date(),
      skills: [{ skill: "Punksiya", count }],
    }).validateSync()?.errors?.["skills.0.count"];

  it("chegara qiymatlarida xato YO'Q (0 va 1000)", () => {
    expect(errFor(SKILL_COUNT_MIN)).toBeUndefined();
    expect(errFor(SKILL_COUNT_MAX)).toBeUndefined();
  });

  it("chegaradan tashqarisi model darajasida ham yiqiladi (-1 va 1001)", () => {
    expect(errFor(SKILL_COUNT_MIN - 1)).toBeDefined();
    expect(errFor(SKILL_COUNT_MAX + 1)).toBeDefined();
  });
});
