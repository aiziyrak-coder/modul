"use strict";

const { buildFilter } = require("./residencyNotice.controller");

const MINE = "6a5a0acbd34b3c21a575daaa";
const OTHER = "6a5a0acbd34b3c21a575dbbb";

describe("qidiruv — qism-satr, escape bilan", () => {
  it("oddiy so'rov registrga sezgir bo'lmagan qism-satrga aylanadi", () => {
    expect(buildFilter({ search: "shartnoma" }, {}).title).toEqual({
      $regex: "shartnoma",
      $options: "i",
    });
  });

  it.each(["(", "[", "+", "a\\", "50%", "Karimov (magistr)"])(
    "metakarakterli so'rov YIQILMAYDI: %p",
    (q) => {
      const rx = buildFilter({ search: q }, {}).title;
      expect(rx.$options).toBe("i");
      expect(() => new RegExp(rx.$regex)).not.toThrow();
    },
  );

  it("kiritma trim qilinadi va ichki bo'shliq siqiladi", () => {
    expect(buildFilter({ search: "  ish   reja " }, {}).title.$regex).toBe("ish reja");
  });

  it.each([undefined, "", "   "])("bo'sh so'rov filtr QO'YMAYDI (%p)", (q) => {
    expect(buildFilter({ search: q }, {})).not.toHaveProperty("title");
  });

  it("bog'lanmagan (anchor'siz) — qism-satr, prefiks emas", () => {
    const { $regex } = buildFilter({ search: "reja" }, {}).title;
    expect($regex.startsWith("^")).toBe(false);
    expect($regex.endsWith("$")).toBe(false);
  });
});

describe("`?resident=` doirani kengaytira olmaydi", () => {
  it("doira bu kalitni cheklamasa — erkin filtrlaydi", () => {
    expect(buildFilter({ resident: MINE }, {}).resident).toBe(MINE);
  });

  it("doira ichidagi rezident o'tadi", () => {
    const scope = { resident: { $in: [MINE] } };
    expect(buildFilter({ resident: MINE }, scope).resident).toBe(MINE);
  });

  it("doiradan TASHQARIDAGI rezident bo'sh natija beradi", () => {
    const scope = { resident: { $in: [MINE] } };
    expect(buildFilter({ resident: OTHER }, scope).resident).toEqual({ $in: [] });
  });

  it("rezident so'ralmasa filtrga qo'shilmaydi", () => {
    expect(buildFilter({}, { resident: { $in: [MINE] } })).not.toHaveProperty(
      "resident",
    );
  });
});
