"use strict";

const V = require("./resident.validation");
const { RESIDENT_STATUSES, STATUS_IN_STUDY } = require("./resident.model");

describe("enum — model haqiqat manbai", () => {
  test("uchta qiymat, D-A7 bo'yicha", () => {
    expect(RESIDENT_STATUSES).toEqual([
      "oquvda",
      "chetlatilgan",
      "akademik_tatil",
    ]);
  });

  test("qiymat soni 3 — yangisi TZ asosisiz qo'shilmasin", () => {
    expect(RESIDENT_STATUSES).toHaveLength(3);
  });

  test("`STATUS_IN_STUDY` enum ichida", () => {
    expect(RESIDENT_STATUSES).toContain(STATUS_IN_STUDY);
    expect(STATUS_IN_STUDY).toBe("oquvda");
  });
});

describe("changeStatusSchema — qo'lda o'zgartirish", () => {
  const ok = (body) => V.changeStatusSchema.validate(body).error;

  test("`akademik_tatil` QABUL qilinadi", () => {
    expect(ok({ status: "akademik_tatil", reason: "Sog'liq" })).toBeUndefined();
  });

  test("`oquvda` QABUL qilinadi (ta'tildan qaytish)", () => {
    expect(ok({ status: "oquvda", reason: "Ta'til tugadi" })).toBeUndefined();
  });

  test("`chetlatilgan` RAD ETILADI", () => {
    const err = ok({ status: "chetlatilgan", reason: "72 soat" });
    expect(err).toBeDefined();
    expect(err.message).toMatch(/imzolangan buyruq/i);
  });

  test("noma'lum qiymat RAD ETILADI", () => {
    expect(ok({ status: "bitirgan", reason: "tugatdi" })).toBeDefined();
  });

  test("`reason` MAJBURIY — holat o'zgarishi dalil qoldiradi", () => {
    const err = ok({ status: "akademik_tatil" });
    expect(err).toBeDefined();
    expect(err.message).toMatch(/[Ss]abab/);
  });

  test("juda qisqa `reason` RAD ETILADI", () => {
    expect(ok({ status: "oquvda", reason: "a" })).toBeDefined();
  });

  test("ortiqcha maydon RAD ETILADI (allowlist)", () => {
    expect(
      ok({ status: "oquvda", reason: "sabab", active: true }),
    ).toBeDefined();
  });
});

describe("mass-assignment — `status` mijoz tanasidan YOZILMAYDI", () => {
  test("`updateResidentSchema` `status` ni RAD ETADI", () => {
    const { error } = V.updateResidentSchema.validate({
      fullName: "Aliyev Ali",
      status: "oquvda",
    });
    expect(error).toBeDefined();
  });

  test("`createResidentSchema` `status` ni RAD ETADI", () => {
    const { error } = V.createResidentSchema.validate({
      fullName: "Aliyev Ali",
      program: "ordinatura",
      status: "chetlatilgan",
    });
    expect(error).toBeDefined();
  });

  test("`listQuery` `status` ni FILTR sifatida qabul qiladi", () => {
    const { error } = V.listQuery.validate({ status: "akademik_tatil" });
    expect(error).toBeUndefined();
  });

  test("`listQuery` noma'lum holatni RAD ETADI", () => {
    const { error } = V.listQuery.validate({ status: "bitirgan" });
    expect(error).toBeDefined();
  });
});
