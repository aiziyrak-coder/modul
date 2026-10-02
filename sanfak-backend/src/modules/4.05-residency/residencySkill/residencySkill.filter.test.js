"use strict";

const { buildFilter } = require("./residencySkill.controller");

describe("ko'nikma qidiruvi", () => {
  it("qism-satr, registrga sezgir emas", () => {
    expect(buildFilter({ search: "kateter" }).practicalSkill).toEqual({
      $regex: "kateter",
      $options: "i",
    });
  });

  it.each(["(Foley)", "(", ")", "+", "a\\"])(
    "metakarakterli so'rov YIQILMAYDI: %p",
    (q) => {
      const rx = buildFilter({ search: q }).practicalSkill;
      expect(() => new RegExp(rx.$regex)).not.toThrow();
      expect(rx.$options).toBe("i");
    },
  );

  it.each([undefined, "", "   "])("bo'sh so'rov filtr QO'YMAYDI (%p)", (q) => {
    expect(buildFilter({ search: q })).not.toHaveProperty("practicalSkill");
  });

  it("boshqa filtrlar tegilmaydi", () => {
    const data = buildFilter({ search: "  ", semester: "1" });
    expect(data).toEqual({ semester: "1" });
  });
});
