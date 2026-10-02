"use strict";

const { buildFilter } = require("./residencyProblemStudent.controller");

describe("F.I.Sh qidiruvi", () => {
  it("qism-satr, registrga sezgir emas", () => {
    expect(buildFilter({ search: "karimov" }).fullName).toEqual({
      $regex: "karimov",
      $options: "i",
    });
  });

  it.each(["Karimov (magistr)", "[", "+", "a\\", "50%"])(
    "metakarakterli so'rov YIQILMAYDI: %p",
    (q) => {
      const rx = buildFilter({ search: q }).fullName;
      expect(() => new RegExp(rx.$regex)).not.toThrow();
      expect(rx.$options).toBe("i");
    },
  );

  it("kirill so'rov ham registrga sezgir emas", () => {
    expect(buildFilter({ search: "Ҳамдамов" }).fullName).toEqual({
      $regex: "Ҳамдамов",
      $options: "i",
    });
  });

  it.each([undefined, "", "   "])("bo'sh so'rov filtr QO'YMAYDI (%p)", (q) => {
    expect(buildFilter({ search: q })).not.toHaveProperty("fullName");
  });
});
