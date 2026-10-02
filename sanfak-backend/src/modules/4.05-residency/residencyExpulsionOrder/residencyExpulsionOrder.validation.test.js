"use strict";

const { stableStringify } = require("#shared/requireEri");
const V = require("./residencyExpulsionOrder.validation");

const ID = "64b0000000000000000000a1";
const SHA = "a".repeat(64);
const BODY = { orderId: ID, paperOrderNumber: "12-ch", paperOrderDate: "2026-10-03", scanSha256: SHA };
const check = (schema, body) => schema.validate(body);

describe("signSchema — satrlar, o'zgartirishsiz", () => {
  test("to'g'ri tana va ixtiyoriy/bo'sh `eriSignature` o'tadi", () => {
    expect(check(V.signSchema, BODY).error).toBeUndefined();
    expect(check(V.signSchema, { ...BODY, eriSignature: "" }).error).toBeUndefined();
    expect(check(V.signSchema, { ...BODY, eriSignature: null }).error).toBeUndefined();
  });

  test.each([
    ["bo'shliq bilan raqam", { paperOrderNumber: " 12" }],
    ["oxirida bo'shliq", { paperOrderNumber: "12 " }],
    ["ko'p qatorli raqam", { paperOrderNumber: "12\nx" }],
    ["65 belgili raqam", { paperOrderNumber: "x".repeat(65) }],
    ["katta harfli sha", { scanSha256: "A".repeat(64) }],
    ["qisqa sha", { scanSha256: "a".repeat(63) }],
    ["sana formati", { paperOrderDate: "2026-10-3" }],
    ["sana obyekt emas satr", { paperOrderDate: new Date("2026-10-03") }],
    ["raqam turi", { paperOrderNumber: 12 }],
    ["noto'g'ri orderId", { orderId: "x" }],
    ["64 KB dan katta imzo", { eriSignature: "A".repeat(65537) }],
  ])("%s — 400", (_label, patch) => {
    expect(check(V.signSchema, { ...BODY, ...patch }).error).toBeDefined();
  });

  test.each(["eriData", "eriKey", "eriSerialNumber", "eriSignedAt", "signedBy", "status"])(
    "`%s` E'LON QILINMAGAN — 400",
    (key) => {
      expect(check(V.signSchema, { ...BODY, [key]: "x" }).error).toBeDefined();
    },
  );

  test("Joi chiqargan tana — kanonik to'rt satr (imzolanadigan bayt)", () => {
    const { value } = check(V.signSchema, { ...BODY, eriSignature: "SIG" });
    expect(stableStringify({ ...value, eriSignature: undefined })).toBe(
      `{"orderId":"${ID}","paperOrderDate":"2026-10-03","paperOrderNumber":"12-ch","scanSha256":"${SHA}"}`,
    );
  });
});

describe("rejectSchema / paginateQuery / idSchema", () => {
  test("rad etish sababi trim qilinadi (ERI yo'q), 3..1000", () => {
    expect(check(V.rejectSchema, { orderId: ID, reason: "  Sababli  " }).value.reason).toBe("Sababli");
    expect(check(V.rejectSchema, { orderId: ID, reason: "ab" }).error).toBeDefined();
    expect(check(V.rejectSchema, { reason: "Sababli" }).error).toBeDefined();
  });

  test("sahifalash: `page`/`limit` majburiy, limit ≤ 100, filtrlar enum", () => {
    expect(check(V.paginateQuery, { page: 1, limit: 10, status: "loyiha", origin: "meros" }).error).toBeUndefined();
    expect(check(V.paginateQuery, { limit: 10 }).error).toBeDefined();
    expect(check(V.paginateQuery, { page: 1, limit: 101 }).error).toBeDefined();
    expect(check(V.paginateQuery, { page: 1, limit: 10, status: "yangi" }).error).toBeDefined();
  });

  test("`:id` — ObjectId", () => {
    expect(check(V.idSchema, { id: ID }).error).toBeUndefined();
    expect(check(V.idSchema, { id: "paginate" }).error).toBeDefined();
  });

  test("URL ko'rinishidagi maydon yo'q", () => {
    const keys = [V.signSchema, V.rejectSchema, V.paginateQuery].flatMap((s) => Object.keys(s.describe().keys));
    expect(keys.filter((k) => /(url|link|href|photo|src|path)$/i.test(k))).toEqual([]);
  });
});
