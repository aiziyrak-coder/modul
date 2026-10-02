"use strict";

const { applyScopedEquals } = require("./scopeGuard");

const OWN = "6a5a0acbd34b3c21a575d5c8";
const OTHER = "6a5a0acbd34b3c21a575d5ff";

describe("applyScopedEquals — bitta qiymatli doira", () => {
  it("doira ichidagi qiymat o'tadi", () => {
    const f = {};
    expect(applyScopedEquals(f, { department: OWN }, "department", OWN)).toBe(true);
    expect(f).toEqual({ department: OWN });
  });

  it("doiradan TASHQARIDAGI qiymat bo'sh natija beradi", () => {
    const f = {};
    expect(applyScopedEquals(f, { department: OWN }, "department", OTHER)).toBe(false);
    expect(f).toEqual({ department: { $in: [] } });
  });

  it("doira qiymatini HECH QACHON almashtirmaydi", () => {
    const f = {};
    applyScopedEquals(f, { department: OWN }, "department", OTHER);
    expect(f.department).not.toBe(OTHER);
  });
});

describe("applyScopedEquals — ro'yxatli doira", () => {
  it("ro'yxatdagi qiymat o'tadi va filtrni TORAYTIRADI", () => {
    const f = {};
    const scope = { resident: { $in: [OWN, "x"] } };
    expect(applyScopedEquals(f, scope, "resident", OWN)).toBe(true);
    expect(f).toEqual({ resident: OWN });
  });

  it("ro'yxatda yo'q qiymat bo'sh natija beradi", () => {
    const f = {};
    const scope = { resident: { $in: [OWN] } };
    expect(applyScopedEquals(f, scope, "resident", OTHER)).toBe(false);
    expect(f).toEqual({ resident: { $in: [] } });
  });

  it("bo'sh ro'yxatli doira hech narsani o'tkazmaydi", () => {
    const f = {};
    expect(applyScopedEquals(f, { resident: { $in: [] } }, "resident", OWN)).toBe(false);
    expect(f).toEqual({ resident: { $in: [] } });
  });

  it("ObjectId va satr ko'rinishini bir xil deb biladi", () => {
    const f = {};
    const scope = { resident: { $in: [{ toString: () => OWN }] } };
    expect(applyScopedEquals(f, scope, "resident", OWN)).toBe(true);
  });
});

describe("applyScopedEquals — cheklovsiz doira", () => {
  it.each([{}, { boshqa: 1 }, null, undefined])(
    "doira bu kalitni cheklamasa query erkin filtrlaydi (%p)",
    (scope) => {
      const f = {};
      expect(applyScopedEquals(f, scope, "department", OTHER)).toBe(true);
      expect(f).toEqual({ department: OTHER });
    },
  );
});

describe("applyScopedEquals — bo'sh query", () => {
  it.each([undefined, null, ""])("qiymat berilmasa filtrga TEGMAYDI (%p)", (v) => {
    const f = { active: true };
    expect(applyScopedEquals(f, { department: OWN }, "department", v)).toBe(true);
    expect(f).toEqual({ active: true });
  });
});
