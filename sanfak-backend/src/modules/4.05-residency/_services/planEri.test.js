"use strict";

const activityV = require("#modules/4.05-residency/activityPlan/activityPlan.validation");
const dissertationV = require("#modules/4.05-residency/dissertationPlan/dissertationPlan.validation");

const ok = (schema, body) => schema.validate(body, { abortEarly: false });

describe.each([
  ["activityPlan", activityV],
  ["dissertationPlan", dissertationV],
])("%s — approveSchema", (_name, V) => {
  it("`eriSignature` QABUL qilinadi (aks holda 400 bo'lib imzo yetib bormasdi)", () => {
    expect(ok(V.approveSchema, { eriSignature: "BASE64==" }).error).toBeUndefined();
  });

  it("`eriData` ham qabul qilinadi", () => {
    expect(
      ok(V.approveSchema, { eriSignature: "BASE64==", eriData: "REFUQQ==" }).error,
    ).toBeUndefined();
  });

  it("eski mijoz — faqat `eriKey` bilan ham o'tadi (yumshoq rejim)", () => {
    expect(ok(V.approveSchema, { eriKey: "token" }).error).toBeUndefined();
  });

  it("bo'sh tana ham o'tadi (imzosiz tasdiq)", () => {
    expect(ok(V.approveSchema, {}).error).toBeUndefined();
  });

  it("🔴 `eriSerialNumber` MIJOZDAN qabul qilinmaydi", () => {
    const { error } = ok(V.approveSchema, { eriSerialNumber: "SOXTA123" });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/eriSerialNumber/);
  });

  it("🔴 `eriSignedAt` ham mijozdan qabul qilinmaydi", () => {
    expect(ok(V.approveSchema, { eriSignedAt: "2026-08-23" }).error).toBeDefined();
  });
});

describe("route zanjiri", () => {
  it.each(["activityPlan", "dissertationPlan"])(
    "%s: approve route'ida `requireEri` bor va validatordan KEYIN",
    (mod) => {
      const src = require("fs").readFileSync(
        `${__dirname}/../${mod}/${mod}.routes.js`,
        "utf8",
      );
      const approveBlock = src.slice(src.indexOf('.route("/:id/approve")'));
      const vIdx = approveBlock.indexOf("validator.body(V.approveSchema)");
      const eIdx = approveBlock.indexOf("requireEri(");

      expect(vIdx).toBeGreaterThan(-1);
      expect(eIdx).toBeGreaterThan(-1);
      expect(eIdx).toBeGreaterThan(vIdx);
    },
  );

  it.each(["activityPlan", "dissertationPlan"])("%s: YUMSHOQ rejim", (mod) => {
    const src = require("fs").readFileSync(
      `${__dirname}/../${mod}/${mod}.routes.js`,
      "utf8",
    );
    expect(src).toMatch(/requireEri\(\{\s*optional:\s*true\s*\}\)/);
  });
});

describe("ApprovalSchema", () => {
  const { ApprovalSchema } = require("./workPlanSchemas");

  it("tekshirilgan dalil `eriKey` dan ALOHIDA saqlanadi", () => {
    const paths = Object.keys(ApprovalSchema.paths);
    expect(paths).toEqual(
      expect.arrayContaining(["eriKey", "eriSerialNumber", "eriSignedAt"]),
    );
  });

  it("imzosiz tasdiqda dalil maydonlari `null`", () => {
    expect(ApprovalSchema.path("eriSerialNumber").defaultValue).toBeNull();
    expect(ApprovalSchema.path("eriSignedAt").defaultValue).toBeNull();
  });
});
