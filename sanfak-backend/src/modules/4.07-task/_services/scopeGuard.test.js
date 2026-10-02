"use strict";

const { applyScopedEquals } = require("./scopeGuard");

const ME = "6a7da70157df92f4847a95a5";
const OTHER = "6a7da70157df92f4847a95a7";

describe("applyScopedEquals — bitta qiymatli doira (menga biriktirilganlar)", () => {
  it("o'z id'si bilan filtrlash o'tadi", () => {
    const f = {};
    expect(applyScopedEquals(f, { assignee: ME }, "assignee", ME)).toBe(true);
    expect(f).toEqual({ assignee: ME });
  });

  it("BEGONA id bo'sh natija beradi, doirani almashtirmaydi", () => {
    const f = {};
    expect(applyScopedEquals(f, { assignee: ME }, "assignee", OTHER)).toBe(false);
    expect(f).toEqual({ assignee: { $in: [] } });
    expect(f.assignee).not.toBe(OTHER);
  });

  it("ObjectId va satr ko'rinishini bir xil deb biladi", () => {
    const f = {};
    const scoped = { toString: () => ME };
    expect(applyScopedEquals(f, { assignee: scoped }, "assignee", ME)).toBe(true);
    expect(f.assignee).toBe(scoped);
    expect(String(f.assignee)).toBe(ME);
  });
});

describe("applyScopedEquals — mos kelganda DOIRA qiymati (tipi saqlanadi)", () => {
  const { Types } = require("mongoose");

  it("bitta qiymatli doira: ObjectId qaytadi, mijoz satri EMAS", () => {
    const oid = new Types.ObjectId(ME);
    const f = {};
    applyScopedEquals(f, { assignee: oid }, "assignee", ME);
    expect(f.assignee).toBeInstanceOf(Types.ObjectId);
    expect(String(f.assignee)).toBe(ME);
  });

  it("ro'yxatli doira: mos kelgan ELEMENT qaytadi", () => {
    const oid = new Types.ObjectId(ME);
    const f = {};
    applyScopedEquals(f, { assignee: { $in: [oid] } }, "assignee", ME);
    expect(f.assignee).toBeInstanceOf(Types.ObjectId);
    expect(f.assignee).toBe(oid);
  });
});

describe("applyScopedEquals — doira bu kalitni cheklamaydi", () => {
  it.each([{ createdBy: ME }, {}, null, undefined])(
    "query erkin filtrlaydi (%p)",
    (scope) => {
      const f = { ...(scope || {}) };
      expect(applyScopedEquals(f, scope, "assignee", OTHER)).toBe(true);
      expect(f.assignee).toBe(OTHER);
    },
  );
});

describe("applyScopedEquals — ro'yxatli doira", () => {
  it("ro'yxatdagi qiymat o'tadi", () => {
    const f = {};
    expect(applyScopedEquals(f, { assignee: { $in: [ME, "x"] } }, "assignee", ME)).toBe(true);
    expect(f).toEqual({ assignee: ME });
  });

  it("ro'yxatda yo'q qiymat bo'sh natija beradi", () => {
    const f = {};
    expect(applyScopedEquals(f, { assignee: { $in: [ME] } }, "assignee", OTHER)).toBe(false);
    expect(f).toEqual({ assignee: { $in: [] } });
  });

  it("bo'sh ro'yxatli doira hech narsani o'tkazmaydi", () => {
    const f = {};
    expect(applyScopedEquals(f, { assignee: { $in: [] } }, "assignee", ME)).toBe(false);
    expect(f).toEqual({ assignee: { $in: [] } });
  });
});

describe("applyScopedEquals — bo'sh query", () => {
  it.each([undefined, null, ""])("qiymat berilmasa filtrga TEGMAYDI (%p)", (v) => {
    const f = { assignee: ME };
    expect(applyScopedEquals(f, { assignee: ME }, "assignee", v)).toBe(true);
    expect(f).toEqual({ assignee: ME });
  });
});
