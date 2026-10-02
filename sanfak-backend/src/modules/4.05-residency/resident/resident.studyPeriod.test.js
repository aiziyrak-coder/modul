"use strict";

const {
  createResidentSchema,
  updateResidentSchema,
} = require("./resident.validation");
const Resident = require("./resident.model");
const { STUDY_PERIOD_MIN, STUDY_PERIOD_MAX } = require("./resident.model");
const { parseRow } = require("#modules/4.05-residency/_services/rosterImport");

const base = { fullName: "Aliyev Sardor", program: "ordinatura" };
const create = (studyPeriod) =>
  createResidentSchema.validate({ ...base, studyPeriod }, { abortEarly: false });
const update = (studyPeriod) =>
  updateResidentSchema.validate({ studyPeriod }, { abortEarly: false });

describe("Joi — createResidentSchema.studyPeriod", () => {
  it("chegara qiymatlari QABUL qilinadi (1 va 10)", () => {
    expect(create(1).error).toBeUndefined();
    expect(create(10).error).toBeUndefined();
  });

  it("chegaradan SAL tashqarisi RAD etiladi (0 va 11)", () => {
    expect(create(0).error).toBeDefined();
    expect(create(11).error).toBeDefined();
  });

  it("jonli bazadagi buzuq qiymat (25) RAD etiladi", () => {
    expect(create(25).error).toBeDefined();
  });

  it("kasr son RAD etiladi (2.5) — muddat YILDA o'lchanadi", () => {
    expect(create(2.5).error).toBeDefined();
  });

  it("`null` — muddat belgilanmagan, RUXSAT etiladi", () => {
    expect(create(null).error).toBeUndefined();
  });

  it("umuman berilmasa o'tadi (mutaxassislikdan olinadi)", () => {
    expect(createResidentSchema.validate(base).error).toBeUndefined();
  });
});

describe("Joi — updateResidentSchema.studyPeriod", () => {
  it("chegara qiymatlari QABUL qilinadi (1 va 10)", () => {
    expect(update(1).error).toBeUndefined();
    expect(update(10).error).toBeUndefined();
  });

  it("chegaradan tashqarisi RAD etiladi (0, 11, 25, 2.5)", () => {
    expect(update(0).error).toBeDefined();
    expect(update(11).error).toBeDefined();
    expect(update(25).error).toBeDefined();
    expect(update(2.5).error).toBeDefined();
  });
});

describe("Mongoose — resident.model.studyPeriod (ikkala yo'l uchun umumiy qopqon)", () => {
  const errFor = (studyPeriod) =>
    new Resident({ ...base, studyPeriod }).validateSync()?.errors?.studyPeriod;

  it("chegara qiymatlarida xato YO'Q (1 va 10)", () => {
    expect(errFor(1)).toBeUndefined();
    expect(errFor(10)).toBeUndefined();
  });

  it("chegaradan tashqarisi model darajasida ham yiqiladi (0, 11, 25)", () => {
    expect(errFor(0)).toBeDefined();
    expect(errFor(11)).toBeDefined();
    expect(errFor(25)).toBeDefined();
  });

  it("kasr son model darajasida ham yiqiladi (2.5)", () => {
    expect(errFor(2.5)).toBeDefined();
  });

  it("`null` — model uchun ham yaroqli (default)", () => {
    expect(errFor(null)).toBeUndefined();
  });
});

describe("Excel importi — parseRow (dryRun'da ham ishlaydi)", () => {
  const raw = (studyPeriod) => ({
    lastName: "Aliyev",
    firstName: "Sardor",
    jshshir: "12345678901234",
    program: "ordinatura",
    studyPeriod,
  });
  const errors = (v) => parseRow(raw(v), false).errors;
  const periodErrors = (v) => errors(v).filter((e) => /muddat/i.test(e));

  it("chegara qiymatlari QABUL qilinadi", () => {
    expect(periodErrors(String(STUDY_PERIOD_MIN))).toHaveLength(0);
    expect(periodErrors(String(STUDY_PERIOD_MAX))).toHaveLength(0);
    expect(parseRow(raw("3"), false).value.studyPeriod).toBe(3);
  });

  it("chegaradan SAL tashqarisi RAD etiladi (model chegarasi ±1)", () => {
    expect(periodErrors(String(STUDY_PERIOD_MIN - 1))).not.toHaveLength(0);
    expect(periodErrors(String(STUDY_PERIOD_MAX + 1))).not.toHaveLength(0);
  });

  it("kasr son RAD etiladi — o'zbek verguli bilan yozilgani ham (\"2,5\")", () => {
    expect(periodErrors("2.5")).not.toHaveLength(0);
    expect(periodErrors("2,5")).not.toHaveLength(0);
  });

  it("son bo'lmagan qiymat eski xabari bilan RAD etiladi", () => {
    expect(periodErrors("ikki")).not.toHaveLength(0);
  });

  it("ustun bo'sh bo'lsa — muddat bo'yicha xato YO'Q (ixtiyoriy)", () => {
    expect(periodErrors("")).toHaveLength(0);
    expect(parseRow(raw(""), false).value.studyPeriod).toBeUndefined();
  });
});
