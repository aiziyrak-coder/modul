"use strict";

const { checkScoreWindow, GATED_PROGRAM } = require("./scoreWindow");

const SETTINGS = { workDayFrom: "09:00", workDayTo: "14:00" };

const ok = {
  program: "ordinatura",
  status: "present",
  samsVerified: false,
  manualVerified: true,
  checkInTime: "09:00",
  checkOutTime: "14:00",
};

const run = (patch = {}, settings = SETTINGS) =>
  checkScoreWindow({ ...ok, ...patch }, settings);

describe("dastur bo'yicha qamrov", () => {
  it("qoida ordinaturaga qo'llanadi", () => {
    expect(GATED_PROGRAM).toBe("ordinatura");
  });

  it("ordinatura — asosiy holat o'tadi", () => {
    expect(run()).toEqual({ ok: true });
  });

  it("magistratura — HECH QANDAY shart tekshirilmaydi", () => {
    expect(run({ program: "magistratura", status: "absent" })).toEqual({ ok: true });
    expect(
      run({ program: "magistratura", manualVerified: false, checkInTime: "03:00" }),
    ).toEqual({ ok: true });
  });

  it("dasturi noma'lum yozuv ham tegilmaydi", () => {
    expect(run({ program: undefined, status: "absent" })).toEqual({ ok: true });
  });
});

describe("holat sharti (userflow §5.3.2)", () => {
  it.each(["absent", "excused"])("%s — ball qo'yilmaydi", (status) => {
    const r = run({ status });
    expect(r.ok).toBe(false);
    expect(r.message).toContain("keldi");
  });
});

describe("tasdiq sharti", () => {
  it("SAMS tasdig'i yetarli", () => {
    expect(run({ samsVerified: true, manualVerified: false })).toEqual({ ok: true });
  });

  it("qo'lda tasdiq yetarli", () => {
    expect(run({ samsVerified: false, manualVerified: true })).toEqual({ ok: true });
  });

  it("🔴 ikkalasi ham yo'q — ball qo'yilmaydi", () => {
    const r = run({ samsVerified: false, manualVerified: false });
    expect(r.ok).toBe(false);
    expect(r.message).toContain("tasdiqlanmagan");
  });
});

describe("ish kuni oynasi — kesishma (D-TIME, I4-Q1)", () => {
  it.each([
    ["aniq chegaralar", "09:00", "14:00", true],
    ["kechikib kelgan", "09:15", "14:00", true],
    ["erta ketgan", "09:00", "13:40", true],
    ["ish kunidan OLDIN kelgan, ichida ketgan", "08:30", "14:00", true],
    ["ichida kelgan, KEYIN ketgan", "09:00", "15:00", true],
    ["butun kunni qoplagan", "08:00", "18:00", true],
    ["1 daqiqa kesishma — boshida", "08:59", "09:01", true],
    ["1 daqiqa kesishma — oxirida", "13:59", "16:00", true],
    ["🔴 butunlay oldin", "07:00", "08:59", false],
    ["🔴 boshiga TEGADI (09:00 da ketgan)", "08:00", "09:00", false],
    ["🔴 oxiriga TEGADI (14:00 da kelgan)", "14:00", "16:00", false],
    ["🔴 butunlay keyin", "15:00", "16:00", false],
  ])("%s (%s–%s) → %s", (_label, checkInTime, checkOutTime, allowed) => {
    expect(run({ checkInTime, checkOutTime }).ok).toBe(allowed);
  });

  it("rad xabari oynani va sababni aytadi", () => {
    const r = run({ checkInTime: "15:00", checkOutTime: "16:00" });
    expect(r.message).toContain("09:00–14:00");
    expect(r.message).toContain("klinikada bo'lgani qayd etilmagan");
  });

  it("solishtiruv DAQIQADA, satr sifatida emas", () => {
    expect(run({ checkInTime: "09:30", checkOutTime: "13:00" })).toEqual({ ok: true });
  });
});

describe("ish kuni oynasi — sozlamadan", () => {
  it("08:00–18:00 da ertalabki qisqa yozuv O'TADI (09:00–14:00 da rad)", () => {
    const early = { checkInTime: "08:10", checkOutTime: "08:50" };
    expect(run(early).ok).toBe(false);
    expect(run(early, { workDayFrom: "08:00", workDayTo: "18:00" })).toEqual({ ok: true });
  });

  it("oyna toraytirilsa (10:00–12:00): kesishmagan yozuv rad, qoplagani o'tadi", () => {
    const narrow = { workDayFrom: "10:00", workDayTo: "12:00" };
    expect(run({ checkInTime: "12:30", checkOutTime: "13:30" }, narrow).ok).toBe(false);
    expect(run({ checkInTime: "09:00", checkOutTime: "14:00" }, narrow)).toEqual({ ok: true });
  });
});

describe("eski yozuv (vaqt yozilmagan)", () => {
  it.each([
    ["ikkalasi null", { checkInTime: null, checkOutTime: null }],
    ["ikkalasi undefined", { checkInTime: undefined, checkOutTime: undefined }],
    ["faqat kelgani bor", { checkOutTime: null }],
    ["faqat ketgani bor", { checkInTime: null }],
  ])("%s — oyna tekshirilmaydi", (_label, patch) => {
    expect(run(patch)).toEqual({ ok: true });
  });

  it("vaqtsiz yozuvda ham «keldi» sharti kuchda", () => {
    expect(run({ checkInTime: null, checkOutTime: null, status: "absent" }).ok).toBe(
      false,
    );
  });
});

describe("sozlama o'qilmasa", () => {
  it.each([
    ["bo'sh obyekt", {}],
    ["buzuq qiymat", { workDayFrom: "salom", workDayTo: "14:00" }],
  ])("%s — oyna tekshirilmaydi, qolgan shartlar qoladi", (_label, settings) => {
    expect(run({}, settings)).toEqual({ ok: true });
    expect(run({ status: "absent" }, settings).ok).toBe(false);
  });

  it("argumentsiz chaqiruv yiqilmaydi", () => {
    expect(checkScoreWindow()).toEqual({ ok: true });
  });
});
