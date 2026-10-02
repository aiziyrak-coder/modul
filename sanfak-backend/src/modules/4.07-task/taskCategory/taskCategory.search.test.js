const { buildFilter } = require("./taskCategory.service");

describe("taskCategory buildFilter — `search`", () => {
  test("qism-satr, registrga sezgir emas", () => {
    expect(buildFilter({ search: "ilmiy" }).name).toEqual({
      $regex: "ilmiy",
      $options: "i",
    });
  });

  test("bosh/oxirgi bo'shliq olib tashlanadi", () => {
    expect(buildFilter({ search: "  ilmiy  " }).name.$regex).toBe("ilmiy");
  });

  test("faqat bo'shliqdan iborat so'rov FILTR QO'YMAYDI", () => {
    expect(buildFilter({ search: "   " }).name).toBeUndefined();
  });

  test("metakarakterlar qochiriladi", () => {
    const rx = buildFilter({ search: "ilm (2026)" }).name.$regex;
    expect(rx).not.toBe("ilm (2026)");
    expect(() => new RegExp(rx)).not.toThrow();
    expect(new RegExp(rx, "i").test("Ilm (2026) yili")).toBe(true);
  });

  test("`active` filtri o'zgarmaydi", () => {
    expect(buildFilter({ active: false })).toEqual({ active: false });
  });
});
