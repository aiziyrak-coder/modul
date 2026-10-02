const {
  parseCourseSelection,
  pickSelectedCourses,
} = require("./courseSelection");

describe("parseCourseSelection", () => {
  test.each([undefined, null, "", " , "])("yo'q/bo'sh (%p) → null (hamma kurslar)", (raw) => {
    expect(parseCourseSelection(raw)).toEqual({ courses: null, error: null });
  });

  test('"1,2,3,4" → [1,2,3,4]', () => {
    expect(parseCourseSelection("1,2,3,4").courses).toEqual([1, 2, 3, 4]);
  });

  test("massiv shakli (courses=5&courses=6) va probellar", () => {
    expect(parseCourseSelection(["6", " 5 "]).courses).toEqual([5, 6]);
  });

  test("takrorlar olib tashlanadi, tartiblanadi", () => {
    expect(parseCourseSelection("3,1,3,1").courses).toEqual([1, 3]);
  });

  test.each([
    ["a"],
    ["0"],
    ["13"],
    ["1.5"],
    ["-1"],
    ["1e1"],
    [{ $ne: "" }],
    [["1", { $gt: "" }]],
    [5],
    ["1,2,3,4,5,6,7,8,9,10,11,12,1"],
  ])("noto'g'ri kirish %p → error", (raw) => {
    const r = parseCourseSelection(raw);
    expect(r.courses).toBeNull();
    expect(r.error).toMatch(/courses noto'g'ri/);
  });
});

describe("pickSelectedCourses", () => {
  const lpCourses = [1, 2, 3, 4, 5, 6].map((n) => ({ courseNum: n }));

  test("tanlov yo'q → hammasi, missing bo'sh", () => {
    expect(pickSelectedCourses(lpCourses, null)).toEqual({
      courses: lpCourses,
      missing: [],
    });
  });

  test("tanlov → faqat tanlanganlar", () => {
    const r = pickSelectedCourses(lpCourses, [5, 6]);
    expect(r.courses.map((c) => c.courseNum)).toEqual([5, 6]);
    expect(r.missing).toEqual([]);
  });

  test("rejada yo'q kurs → missing", () => {
    const r = pickSelectedCourses(lpCourses.slice(0, 4), [4, 5, 6]);
    expect(r.missing).toEqual([5, 6]);
  });
});
