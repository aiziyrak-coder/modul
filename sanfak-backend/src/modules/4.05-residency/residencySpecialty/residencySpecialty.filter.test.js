"use strict";

const { buildFilter } = require("./residencySpecialty.controller");

describe("mutaxassislik qidiruvi", () => {
  it("title va code bo'ylab $or, registrga sezgir emas", () => {
    expect(buildFilter({ search: "kardio" }).$or).toEqual([
      { title: { $regex: "kardio", $options: "i" } },
      { code: { $regex: "kardio", $options: "i" } },
    ]);
  });

  it.each(["(", "[", "+", "a\\", "50%"])(
    "metakarakterli so'rov YIQILMAYDI: %p",
    (q) => {
      const [{ title }] = buildFilter({ search: q }).$or;
      expect(() => new RegExp(title.$regex)).not.toThrow();
      expect(title.$options).toBe("i");
    },
  );

  it.each([undefined, "", "   "])("bo'sh so'rov filtr QO'YMAYDI (%p)", (q) => {
    expect(buildFilter({ search: q })).not.toHaveProperty("$or");
  });

  it("qidiriladigan maydonlar ro'yxati KENGAYMAYDI", () => {
    expect(buildFilter({ search: "x" }).$or.map((c) => Object.keys(c)[0])).toEqual([
      "title",
      "code",
    ]);
  });
});
