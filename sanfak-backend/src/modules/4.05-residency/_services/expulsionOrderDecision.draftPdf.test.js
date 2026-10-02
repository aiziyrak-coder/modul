jest.mock("#modules/4.05-residency/resident/resident.model");
jest.mock("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model");
jest.mock("./expulsionReversal", () => ({}));
jest.mock("#shared/winston.logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const Order = require("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model");
const {
  attachDraftPdf,
  assertDraftPrintable,
  assertDraftHours,
  assertNoScan,
} = require("./expulsionOrderDecision");

const DRAFTED = new Date("2031-10-01T08:00:00Z");
const NOW = new Date("2031-10-20T06:00:00Z");
const ACTOR = { _id: "u-office", lastName: "Karimova", firstName: "Nodira" };
const order = (extra = {}) => ({
  _id: "o1",
  origin: "tizim",
  status: "loyiha",
  countingYear: "2031/2032",
  draftedAt: DRAFTED,
  noticesSentAt: new Date(DRAFTED.getTime() + 5000),
  scan: null,
  ...extra,
});
const resident = (extra = {}) => ({
  status: "oquvda",
  active: true,
  expulsionOrderCreated: true,
  expulsionOrderCreatedAt: new Date(DRAFTED.getTime()),
  ...extra,
});
const rejects = (reason, code = 409) => expect.objectContaining({ statusCode: code, meta: expect.objectContaining({ reason }) });
const check = (o, r, now = NOW) => () => assertDraftPrintable(o, r, now);

describe("assertDraftPrintable — tartib bilan", () => {
  test("ochiq `tizim`, imzoga mos, ko'rsatkich shu buyruqda, joriy yil — o'tadi", () => {
    expect(check(order(), resident())).not.toThrow();
  });

  test.each([
    ["`meros` (W-3=A)", "draft_pdf_not_available", order({ origin: "meros" }), resident()],
    ["skan yuklangan (W-5=C)", "scan_already_uploaded", order({ scan: { sha256: "a" } }), resident()],
    ["ta'tildagi rezident", "resident_not_signable", order(), resident({ status: "akademik_tatil" })],
    ["chetlatilgan rezident", "resident_not_signable", order(), resident({ status: "chetlatilgan" })],
    ["nofaol rezident", "resident_inactive", order(), resident({ active: false })],
    ["bayroq yo'q", "draft_not_ready", order(), resident({ expulsionOrderCreated: false })],
    ["bayroq boshqa lahzada", "draft_not_ready", order(), resident({ expulsionOrderCreatedAt: new Date(DRAFTED.getTime() + 1) })],
    ["bayroq bor, sanasi `null`", "draft_not_ready", order(), resident({ expulsionOrderCreatedAt: null })],
    ["buyruq sanasi yo'q", "draft_not_ready", order({ draftedAt: null }), resident()],
    ["bayroq shu buyruqda, lekin e'lon qilinmagan", "draft_not_ready", order({ noticesSentAt: null }), resident()],
  ])("%s → 409 %s", (_label, reason, o, r) => {
    expect(check(o, r)).toThrow(rejects(reason));
  });

  test("o'tgan o'quv yili — 409 `draft_year_closed` (yillar javobda)", () => {
    expect(check(order({ countingYear: "2030/2031" }), resident())).toThrow(
      expect.objectContaining({
        statusCode: 409,
        meta: { reason: "draft_year_closed", countingYear: "2030/2031", current: "2031/2032" },
      }),
    );
  });

  test.each([
    ["`meros` + skan", "draft_pdf_not_available", order({ origin: "meros", scan: { sha256: "a" } }), resident()],
    ["ta'til + e'lon qilinmagan", "resident_not_signable", order({ noticesSentAt: null }), resident({ status: "akademik_tatil" })],
    ["o'tgan yil + bayroq yo'q", "draft_not_ready", order({ countingYear: "2030/2031" }), resident({ expulsionOrderCreated: false })],
  ])("tartib: %s → %s", (_label, reason, o, r) => {
    expect(check(o, r)).toThrow(rejects(reason));
  });

  test("`assertNoScan`: skan yo'q — o'tadi", () => {
    expect(() => assertNoScan({ scan: null })).not.toThrow();
    expect(() => assertNoScan({})).not.toThrow();
  });
});

describe("assertDraftHours", () => {
  test.each([
    [71, "hours_below_threshold", 409],
    [Number.NaN, "hours_unavailable", 500],
    [undefined, "hours_unavailable", 500],
  ])("%s → %s", (hours, reason, code) => {
    expect(() => assertDraftHours(hours)).toThrow(rejects(reason, code));
  });

  test("72 va undan yuqori — o'tadi", () => {
    expect(() => assertDraftHours(72)).not.toThrow();
    expect(() => assertDraftHours(140)).not.toThrow();
  });
});

describe("attachDraftPdf — yagona CAS", () => {
  const META = { storageKey: "draft/2026/10/k.pdf", fileName: "f.pdf", size: 9, sha256: "b".repeat(64), hours: 74, templateVersion: 1 };

  test("filtr: ochiq, PDF yo'q, skan yo'q; muallif va vaqt yoziladi; tarixga bitta yozuv", async () => {
    const lean = jest.fn().mockResolvedValue({ _id: "o1", draftPdf: META });
    Order.findOneAndUpdate = jest.fn(() => ({ lean }));
    await expect(attachDraftPdf({ orderId: "o1", draftPdf: META, actor: ACTOR, now: NOW })).resolves.toMatchObject({ _id: "o1" });
    const [filter, update, opts] = Order.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: "o1", status: "loyiha", draftPdf: null, scan: null });
    expect(update.$set).toEqual({
      draftPdf: { ...META, generatedBy: "u-office", generatedByName: "Karimova Nodira", generatedAt: NOW },
    });
    expect(update.$push).toEqual({
      history: {
        at: NOW,
        action: "pdf_yaratildi",
        source: "office",
        actor: "u-office",
        actorName: "Karimova Nodira",
        hours: 74,
        note: `sha256 ${"b".repeat(64)}`,
      },
    });
    expect(opts).toEqual({ new: true });
  });

  test("yutqazilgan CAS — `null` (yozuv yo'q)", async () => {
    Order.findOneAndUpdate = jest.fn(() => ({ lean: jest.fn().mockResolvedValue(null) }));
    await expect(attachDraftPdf({ orderId: "o1", draftPdf: META, actor: ACTOR, now: NOW })).resolves.toBeNull();
  });
});
