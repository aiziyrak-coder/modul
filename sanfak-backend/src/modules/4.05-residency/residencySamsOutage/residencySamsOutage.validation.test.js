"use strict";

const V = require("./residencySamsOutage.validation");

const opts = { abortEarly: false, allowUnknown: false, convert: true };
const create = (body) => V.createSchema.validate(body, opts);
const ok = { from: "2026-09-20", to: "2026-09-21", reason: "Turniket ishlamadi" };

describe("createSchema", () => {
  it("to'g'ri tana; dbname berilmasa — null (barcha klinikalar)", () => {
    const { error, value } = create(ok);
    expect(error).toBeUndefined();
    expect(value.dbname).toBeNull();
  });

  it("dbname naqshi yoki null qabul qilinadi", () => {
    expect(create({ ...ok, dbname: "64f0c2ab_1-x" }).error).toBeUndefined();
    expect(create({ ...ok, dbname: null }).error).toBeUndefined();
  });

  it.each([
    ["mavjud bo'lmagan kun", { from: "2026-02-30" }],
    ["noto'g'ri format", { to: "2026/09/21" }],
    ["dbname '/' bilan", { dbname: "org/1" }],
    ["dbname 101 belgi", { dbname: "a".repeat(101) }],
    ["sabab 2 belgi (trim'dan keyin)", { reason: "  ab  " }],
    ["sabab 501 belgi", { reason: "x".repeat(501) }],
    ["noma'lum maydon", { createdBy: "507f1f77bcf86cd799439011" }],
  ])("%s → xato", (_l, over) => {
    expect(create({ ...ok, ...over }).error).toBeDefined();
  });

  it("sabab trim qilinadi", () => {
    expect(create({ ...ok, reason: "  Elektr yo'q  " }).value.reason).toBe("Elektr yo'q");
  });

  it("from/to/reason majburiy", () => {
    const { error } = create({});
    expect(error.details.map((d) => d.path[0]).sort()).toEqual(["from", "reason", "to"]);
  });
});

describe("cancelSchema, idSchema", () => {
  it("bekor qilish sababi 3..500", () => {
    expect(V.cancelSchema.validate({ reason: "Xato kiritilgan" }).error).toBeUndefined();
    expect(V.cancelSchema.validate({ reason: "ab" }).error).toBeDefined();
    expect(V.cancelSchema.validate({}).error).toBeDefined();
  });

  it("id — 24 belgili hex", () => {
    expect(V.idSchema.validate({ id: "507f1f77bcf86cd799439011" }).error).toBeUndefined();
    expect(V.idSchema.validate({ id: "xyz" }).error).toBeDefined();
  });
});

describe("paginateQuery", () => {
  it("status standarti — active", () => {
    const { error, value } = V.paginateQuery.validate({ page: "1", limit: "20" }, opts);
    expect(error).toBeUndefined();
    expect(value).toEqual({ page: 1, limit: 20, status: "active" });
  });

  it("status, from/to kesishish filtri", () => {
    const q = { page: 1, limit: 100, status: "all", from: "2026-09-01", to: "2026-09-30" };
    expect(V.paginateQuery.validate(q, opts).error).toBeUndefined();
  });

  it.each([
    [{ page: 1 }],
    [{ page: 0, limit: 20 }],
    [{ page: 1, limit: 101 }],
    [{ page: 1, limit: 20, status: "deleted" }],
    [{ page: 1, limit: 20, from: "2026-02-30" }],
    [{ page: 1, limit: 20, includeCancelled: true }],
  ])("%p → xato", (q) => {
    expect(V.paginateQuery.validate(q, opts).error).toBeDefined();
  });
});
