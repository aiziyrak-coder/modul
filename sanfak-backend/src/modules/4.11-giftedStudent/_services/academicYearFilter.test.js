const { applyAcademicYearFilter, isUnset } = require("./academicYearFilter");

const YEAR_ID = "6a7efdac5916905f06cebeb4";

describe("applyAcademicYearFilter — shakl bo'yicha mos maydonga", () => {
  test("24-hex `_id` -> `academicYearId` (ref)", () => {
    expect(applyAcademicYearFilter({}, YEAR_ID)).toEqual({ academicYearId: YEAR_ID });
  });

  const BOTH = { academicYear: { $in: ["2025/2026", "2025-2026"] } };

  test("kanonik sarlavha ikkala imloni ham qamraydi", () => {
    expect(applyAcademicYearFilter({}, "2025/2026")).toEqual(BOTH);
  });

  test("tireli sarlavha ham ikkala imloni qamraydi (eski FE / eski bookmark)", () => {
    expect(applyAcademicYearFilter({}, "2025-2026")).toEqual(BOTH);
  });

  test("yil bo'lmagan qiymat o'zgarishsiz qidiriladi", () => {
    expect(applyAcademicYearFilter({}, "kuzgi")).toEqual({ academicYear: "kuzgi" });
  });

  test("ikkala maydon HECH QACHON birga qo'yilmaydi", () => {
    const a = applyAcademicYearFilter({}, YEAR_ID);
    const b = applyAcademicYearFilter({}, "2025-2026");
    expect(Object.keys(a)).toHaveLength(1);
    expect(Object.keys(b)).toHaveLength(1);
  });

  test("mavjud filtrga QO'SHILADI, ustidan yozmaydi", () => {
    expect(applyAcademicYearFilter({ course: 1 }, YEAR_ID)).toEqual({
      course: 1,
      academicYearId: YEAR_ID,
    });
  });

  test("`academicYearId` bilan `academicYear` HECH QACHON birga qo'yilmaydi", () => {
    const byId = applyAcademicYearFilter({}, YEAR_ID);
    const byTitle = applyAcademicYearFilter({}, "2025/2026");
    expect(byId.academicYear).toBeUndefined();
    expect(byTitle.academicYearId).toBeUndefined();
  });

  describe("`all` sentineli — ikki endpoint bir xil tushunadi", () => {
    test.each(["all", "", null, undefined])("%p = filtr yo'q", (v) => {
      expect(applyAcademicYearFilter({}, v)).toEqual({});
    });
  });
});

describe("isUnset", () => {
  test.each([undefined, null, "", "all"])("%p -> true", (v) => {
    expect(isUnset(v)).toBe(true);
  });

  test.each([0, "0", 1, "2025-2026", YEAR_ID])("%p -> false", (v) => {
    expect(isUnset(v)).toBe(false);
  });
});
