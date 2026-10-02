"use strict";

jest.mock("../_services/residentScope", () => ({ allowedResidentIds: jest.fn() }));

const Notice = require("./residencyNotice.model");
const C = require("./residencyNotice.controller");
const V = require("./residencyNotice.validation");
const { allowedResidentIds } = require("../_services/residentScope");

const ME = "6a5a0acbd34b3c21a575d59d";
const OTHER = "6a5a0acbd34b3c21a575d5ff";
const RESIDENT = "6a5a0acbd34b3c21a575daaa";
const STAFF = { _id: OTHER, role: { title: "magistratura_bolim", scopeLevel: "department" } };
const GLOBAL = { _id: OTHER, role: { title: "super_admin", scopeLevel: "global" } };
const TEACHER = { _id: ME, role: { title: "klinik_ustoz", scopeLevel: "self" } };

const AUTO = { countingYear: "2026/2027", state: "faol", hoursAtIssue: 6, templateVersion: 1 };
const fakeDoc = (extra = {}) => ({
  kind: "oddiy",
  sender: ME,
  status: "yangi",
  save: jest.fn().mockResolvedValue(undefined),
  softDelete: jest.fn().mockResolvedValue(undefined),
  ...extra,
});
const res = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });

async function call(handler, doc, user) {
  jest.spyOn(Notice, "findById").mockResolvedValueOnce(doc);
  const next = jest.fn();
  const r = res();
  await C[handler]({ params: { id: RESIDENT }, user, body: { title: "Yangi" } }, r, next);
  return { err: next.mock.calls[0]?.[0], r };
}

afterEach(() => jest.restoreAllMocks());

describe("PUT/DELETE — avtomatik bildirgi faqat o'qiladi (409)", () => {
  test.each([
    ["updateNotice", "bo'lim xodimi", STAFF],
    ["updateNotice", "global rol", GLOBAL],
    ["updateNotice", "ustoz", TEACHER],
    ["deleteNotice", "bo'lim xodimi", STAFF],
    ["deleteNotice", "ustoz", TEACHER],
  ])("%s — %s: 409 auto_notice_readonly, hujjat tegilmaydi", async (handler, _who, user) => {
    const doc = fakeDoc({ kind: "avtomatik", sender: null, auto: AUTO });
    const { err } = await call(handler, doc, user);
    expect(err).toMatchObject({ statusCode: 409, meta: { reason: "auto_notice_readonly" } });
    expect(err.message).toBe("Tizim bildirgisini tahrirlab yoki o'chirib bo'lmaydi");
    expect(doc.save).not.toHaveBeenCalled();
    expect(doc.softDelete).not.toHaveBeenCalled();
  });
});

describe("qo'lda yozilgan bildirgi — avvalgi qoida o'zgarmagan", () => {
  test("bo'lim xodimi tahrirlaydi", async () => {
    const doc = fakeDoc({ sender: ME });
    const { err, r } = await call("updateNotice", doc, STAFF);
    expect(err).toBeUndefined();
    expect(doc.save).toHaveBeenCalled();
    expect(r.status).toHaveBeenCalledWith(200);
  });

  test("egasi o'chiradi (`yangi`); begona ustoz — 403; ko'rib chiqilayotgan — 400", async () => {
    const own = fakeDoc({ kind: "davomat" });
    expect((await call("deleteNotice", own, TEACHER)).err).toBeUndefined();
    expect(own.softDelete).toHaveBeenCalled();
    expect((await call("updateNotice", fakeDoc({ sender: OTHER }), TEACHER)).err).toMatchObject({ statusCode: 403 });
    expect((await call("updateNotice", fakeDoc({ status: "kutilmoqda" }), TEACHER)).err).toMatchObject({ statusCode: 400 });
  });
});

describe("ko'rish belgisi — avtomatik bildirgida faqat bo'lim/global o'tkazadi", () => {
  test.each([
    ["avtomatik", "bo'lim xodimi", STAFF, true],
    ["avtomatik", "global rol", GLOBAL, true],
    ["avtomatik", "ustoz", TEACHER, false],
    ["oddiy", "ustoz", TEACHER, true],
    ["davomat", "ustoz", TEACHER, true],
  ])("%s — %s: %p", (kind, _who, user, want) => {
    expect(C.marksNoticeSeen({ kind }, user)).toBe(want);
  });

  test("viewNotice: ustoz — 200, `yangi` qoladi, saqlanmaydi; bo'lim — `kutilmoqda`", async () => {
    allowedResidentIds.mockResolvedValue([RESIDENT]);
    const peeked = fakeDoc({ kind: "avtomatik", sender: null, resident: RESIDENT, auto: AUTO });
    const { err, r } = await call("viewNotice", peeked, TEACHER);
    expect(err).toBeUndefined();
    expect(r.json).toHaveBeenCalledWith({ message: "successfully updated", status: "yangi" });
    expect(peeked.save).not.toHaveBeenCalled();
    allowedResidentIds.mockResolvedValue(null);
    const seen = fakeDoc({ kind: "avtomatik", sender: null, resident: RESIDENT, auto: AUTO });
    await call("viewNotice", seen, STAFF);
    expect([seen.status, seen.save.mock.calls.length]).toEqual(["kutilmoqda", 1]);
  });
});

describe("validatsiya va ro'yxat filtri", () => {
  const body = { program: "ordinatura", title: "Sarlavha", content: "Matn" };

  test("POST `kind: avtomatik` — rad etiladi; qo'lda turlar o'tadi", () => {
    expect(V.createSchema.validate({ ...body, kind: "avtomatik" }).error).toBeDefined();
    expect(V.createSchema.validate({ ...body, kind: "oddiy" }).error).toBeUndefined();
    expect(V.createSchema.validate({ ...body, kind: "davomat" }).error).toBeUndefined();
  });

  test("ro'yxat `?kind=avtomatik` qabul qiladi, noma'lum tur — yo'q", () => {
    expect(V.listQuery.validate({ kind: "avtomatik" }).error).toBeUndefined();
    expect(V.paginateQuery.validate({ kind: "avtomatik", page: 1, limit: 10 }).error).toBeUndefined();
    expect(V.listQuery.validate({ kind: "boshqa" }).error).toBeDefined();
  });

  test("`buildFilter` — `kind` endi qo'llanadi, bo'sh bo'lsa qo'yilmaydi", () => {
    expect(C.buildFilter({ kind: "avtomatik" }, {}).kind).toBe("avtomatik");
    expect(C.buildFilter({ kind: "davomat" }, {}).kind).toBe("davomat");
    expect(C.buildFilter({}, {})).not.toHaveProperty("kind");
    expect(C.buildFilter({ kind: "" }, {})).not.toHaveProperty("kind");
  });

  test("`?kind=oddiy` — `kind` maydoni yo'q eski qo'lda yozilganlarni ham tutadi", () => {
    expect(C.buildFilter({ kind: "oddiy" }, {}).kind).toEqual({ $in: ["oddiy", null] });
  });
});

describe("model — avtomatik tur", () => {
  const base = { program: "ordinatura", title: "T", content: "C" };
  const errorsOf = (data) => Object.keys(new Notice(data).validateSync()?.errors || {});

  test("avtomatik: yuboruvchisiz TO'G'RI; `auto` va `resident` majburiy", () => {
    expect(errorsOf({ ...base, kind: "avtomatik", sender: null, resident: RESIDENT, auto: AUTO })).toEqual([]);
    expect(errorsOf({ ...base, kind: "avtomatik", resident: RESIDENT })).toEqual(["auto"]);
    expect(errorsOf({ ...base, kind: "avtomatik", auto: AUTO })).toEqual(["resident"]);
    expect(errorsOf({ ...base, kind: "avtomatik", resident: RESIDENT, auto: { ...AUTO, state: "yopiq" } })).toEqual(["auto.state"]);
  });

  test("qo'lda yozilgan: yuboruvchi hamon majburiy, `auto` — `null`", () => {
    expect(errorsOf({ ...base, kind: "oddiy" })).toEqual(["sender"]);
    expect(errorsOf({ ...base })).toEqual(["sender"]);
    const manual = new Notice({ ...base, sender: ME });
    expect(manual.validateSync()).toBeUndefined();
    expect(manual.auto).toBeNull();
  });

  test("eksportlar — kontrakt nomlari", () => {
    expect(Notice.NOTICE_KINDS).toEqual(["oddiy", "davomat", "avtomatik"]);
    expect(Notice.CLIENT_NOTICE_KINDS).toEqual(["oddiy", "davomat"]);
    expect([Notice.NOTICE_KIND_AUTO, Notice.AUTO_STATE_ACTIVE, Notice.AUTO_STATES])
      .toEqual(["avtomatik", "faol", ["faol", "bekor_qilingan"]]);
  });

  test("qulf indeksi: rezident × o'quv yili, faqat `faol`, satr tengligi", () => {
    const found = Notice.schema.indexes().find(([, opts]) => opts.name === Notice.AUTO_INDEX_NAME);
    expect(found).toEqual([
      { resident: 1, "auto.countingYear": 1 },
      expect.objectContaining({ unique: true, partialFilterExpression: { "auto.state": "faol" } }),
    ]);
    expect(Notice.AUTO_INDEX_NAME).toBe("resident_year_auto_faol_unique");
  });
});
