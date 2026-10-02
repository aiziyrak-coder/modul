"use strict";

const { Types } = require("mongoose");
const { applyCourseFilter } = require("./courseFilter");

const ID = "6a5a0acbd34b3c21a575d5c8";

describe("applyCourseFilter", () => {
  it("son kelsa `courseNumber` bo'yicha filtrlaydi", () => {
    expect(applyCourseFilter({}, "2")).toEqual({ courseNumber: 2 });
  });

  it("sonni son sifatida ham qabul qiladi", () => {
    expect(applyCourseFilter({}, 3)).toEqual({ courseNumber: 3 });
  });

  it("`_id` kelsa `courseRef` bo'yicha ObjectId bilan filtrlaydi", () => {
    const f = applyCourseFilter({}, ID);
    expect(f.courseRef).toBeInstanceOf(Types.ObjectId);
    expect(String(f.courseRef)).toBe(ID);
  });

  it.each([undefined, null, ""])("bo'sh qiymat (%p) filtrga TEGMAYDI", (v) => {
    expect(applyCourseFilter({ active: true }, v)).toEqual({ active: true });
  });

  it("na son, na `_id` bo'lgan qiymat HECH NARSAGA mos kelmaydi", () => {
    expect(applyCourseFilter({}, "Tayyorlov")).toEqual({
      courseNumber: { $in: [] },
    });
  });

  it("mavjud filtrni buzmaydi", () => {
    const f = { active: true };
    applyCourseFilter(f, "1");
    expect(f).toEqual({ active: true, courseNumber: 1 });
  });
});
