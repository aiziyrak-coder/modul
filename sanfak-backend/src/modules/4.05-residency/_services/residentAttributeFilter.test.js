"use strict";

const { intersectResidentIds } = require("./residentAttributeFilter");

describe("intersectResidentIds", () => {
  it("cheklovsiz doiraga ro'yxatni qo'yadi", () => {
    const f = {};
    expect(intersectResidentIds(f, ["a", "b"])).toBe(true);
    expect(f).toEqual({ resident: { $in: ["a", "b"] } });
  });

  it("mavjud ro'yxat bilan KESISHTIRADI (kengaytirmaydi)", () => {
    const f = { resident: { $in: ["a", "c"] } };
    expect(intersectResidentIds(f, ["a", "b"])).toBe(true);
    expect(f).toEqual({ resident: { $in: ["a"] } });
  });

  it("kesishma bo'sh bo'lsa `false` qaytaradi", () => {
    const f = { resident: { $in: ["c"] } };
    expect(intersectResidentIds(f, ["a", "b"])).toBe(false);
  });

  it("aniq bir rezident so'ralgan bo'lsa a'zolikni tekshiradi", () => {
    expect(intersectResidentIds({ resident: "a" }, ["a", "b"])).toBe(true);
    expect(intersectResidentIds({ resident: "z" }, ["a", "b"])).toBe(false);
  });

  it("atributga mos rezident yo'q bo'lsa natija BO'SH bo'ladi", () => {
    expect(intersectResidentIds({}, [])).toBe(false);
  });

  it("ObjectId va satr ko'rinishini bir xil deb biladi", () => {
    const f = { resident: { $in: [{ toString: () => "a" }] } };
    expect(intersectResidentIds(f, ["a"])).toBe(true);
  });
});
