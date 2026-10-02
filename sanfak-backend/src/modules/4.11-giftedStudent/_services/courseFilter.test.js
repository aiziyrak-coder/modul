const { applyCourseFilter, isUnset } = require("./courseFilter");

const COURSE_ID = "69df7a8f94bda50c83a1d4b1";

describe("applyCourseFilter — shakl bo'yicha mos maydonga", () => {
  test("son -> `course` (har bir yozuvda bor)", () => {
    expect(applyCourseFilter({}, 3)).toEqual({ course: 3 });
    expect(applyCourseFilter({}, "3")).toEqual({ course: 3 });
  });

  test("24-hex `_id` -> `courseId` (ref)", () => {
    expect(applyCourseFilter({}, COURSE_ID)).toEqual({ courseId: COURSE_ID });
  });

  test("ikkala maydon HECH QACHON birga qo'yilmaydi", () => {
    expect(Object.keys(applyCourseFilter({}, 3))).toHaveLength(1);
    expect(Object.keys(applyCourseFilter({}, COURSE_ID))).toHaveLength(1);
  });

  test("mavjud filtrga QO'SHILADI", () => {
    expect(applyCourseFilter({ faculty: "X" }, 2)).toEqual({ faculty: "X", course: 2 });
  });

  test("`0` kursi FILTRLANADI — `if (q.course)` naqshi uni tashlab yuborardi", () => {
    expect(applyCourseFilter({}, 0)).toEqual({ course: 0 });
    expect(applyCourseFilter({}, "0")).toEqual({ course: 0 });
  });

  describe("`all` sentineli va bo'sh qiymatlar", () => {
    test.each(["all", "", null, undefined])("%p = filtr yo'q", (v) => {
      expect(applyCourseFilter({}, v)).toEqual({});
    });
  });

  test("son ham, `_id` ham bo'lmagan qiymat `NaN` ga AYLANMAYDI", () => {
    const out = applyCourseFilter({}, "mag-1");
    expect(out.course).toBe("mag-1");
    expect(Number.isNaN(out.course)).toBe(false);
  });
});

describe("isUnset", () => {
  test.each([undefined, null, "", "all"])("%p -> true", (v) => {
    expect(isUnset(v)).toBe(true);
  });

  test.each([0, "0", 1, "3", COURSE_ID])("%p -> false", (v) => {
    expect(isUnset(v)).toBe(false);
  });
});
