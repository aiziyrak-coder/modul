"use strict";

const mongoose = require("mongoose");
const {
  checkEducationFormDefault,
  checkAcademicYears,
  CURRICULUM_DEFAULT_FORM,
} = require("./referencePrecheck");

const mockDb = (data) => {
  Object.defineProperty(mongoose.connection, "db", {
    value: {
      collection: (name) => ({
        find: () => ({ toArray: async () => data[name] ?? [] }),
        countDocuments: async () => (data[name] ?? []).length,
      }),
    },
    configurable: true,
    writable: true,
  });
};

afterEach(() => {
  Object.defineProperty(mongoose.connection, "db", {
    value: undefined,
    configurable: true,
    writable: true,
  });
});

describe("checkEducationFormDefault", () => {
  it("default ma'lumotnomada bo'lsa OK", async () => {
    mockDb({ educationforms: [{ title: "Kunduzgi" }, { title: "Sirtqi" }] });
    await expect(checkEducationFormDefault()).resolves.toEqual({ ok: true });
  });

  it("registr farqi muhim EMAS", async () => {
    mockDb({ educationforms: [{ title: CURRICULUM_DEFAULT_FORM.toUpperCase() }] });
    await expect(checkEducationFormDefault()).resolves.toEqual({ ok: true });
  });

  it("default o'chirilgan bo'lsa MAVJUDLARINI aytadi", async () => {
    mockDb({ educationforms: [{ title: "Sirtqi" }, { title: "Kechki" }] });
    const r = await checkEducationFormDefault();
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("Sirtqi");
    expect(r.reason).toContain("Kechki");
  });

  it("ma'lumotnoma bo'sh bo'lsa buni aniq aytadi", async () => {
    mockDb({ educationforms: [] });
    await expect(checkEducationFormDefault()).resolves.toEqual({
      ok: false,
      reason: "ma'lumotnoma BO'SH",
    });
  });
});

describe("checkAcademicYears", () => {
  it("yillar bor bo'lsa OK", async () => {
    mockDb({ academicyears: [{ title: "2025/2026" }] });
    await expect(checkAcademicYears()).resolves.toEqual({ ok: true });
  });

  it("bo'sh bo'lsa ogohlantiradi", async () => {
    mockDb({ academicyears: [] });
    await expect(checkAcademicYears()).resolves.toEqual({
      ok: false,
      reason: "ma'lumotnoma BO'SH",
    });
  });
});

describe("ulanish yo'q", () => {
  it("aniq xato beradi (chaqiruvchi uni ushlaydi)", async () => {
    await expect(checkAcademicYears()).rejects.toThrow("ulanish hali ochilmagan");
  });
});
