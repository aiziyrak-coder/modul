const { applyFacultyFilter, isUnset } = require("./facultyFilter");

const FAC_ID = "69df7a8f94bda50c83a1d435";

describe("applyFacultyFilter — shakl bo'yicha mos maydonga", () => {
  test("24-hex `_id` -> `facultyId` (ref) — qayta nomlashdan omon qoladi", () => {
    expect(applyFacultyFilter({}, FAC_ID)).toEqual({ facultyId: FAC_ID });
  });

  test("sarlavha -> `faculty` (saqlangan snapshot) — eski xatti-harakat", () => {
    expect(applyFacultyFilter({}, "Farmatsiya fakulteti")).toEqual({
      faculty: "Farmatsiya fakulteti",
    });
  });

  test("ikkala maydon HECH QACHON birga qo'yilmaydi", () => {
    expect(Object.keys(applyFacultyFilter({}, FAC_ID))).toHaveLength(1);
    expect(Object.keys(applyFacultyFilter({}, "X"))).toHaveLength(1);
  });

  test("mavjud filtrga QO'SHILADI, ustidan yozmaydi", () => {
    expect(applyFacultyFilter({ course: 1 }, FAC_ID)).toEqual({
      course: 1,
      facultyId: FAC_ID,
    });
  });

  test("scope kaliti bilan bir xil maydonga tushadi", () => {
    const out = applyFacultyFilter({}, FAC_ID);
    expect(Object.keys(out)).toEqual(["facultyId"]);
  });

  describe("`all` sentineli va bo'sh qiymatlar", () => {
    test.each(["all", "", null, undefined])("%p = filtr yo'q", (v) => {
      expect(applyFacultyFilter({}, v)).toEqual({});
    });
  });
});

describe("isUnset", () => {
  test.each([undefined, null, "", "all"])("%p -> true", (v) => {
    expect(isUnset(v)).toBe(true);
  });

  test.each(["Farmatsiya fakulteti", FAC_ID, "0"])("%p -> false", (v) => {
    expect(isUnset(v)).toBe(false);
  });
});
