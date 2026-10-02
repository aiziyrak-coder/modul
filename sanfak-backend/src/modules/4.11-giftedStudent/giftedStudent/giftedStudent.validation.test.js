const { findAll, studentSchema } = require("./giftedStudent.validation");

const COURSE_ID = "69df7a8f94bda50c83a1d3f5";
const okFindAll = (v) => findAll.validate({ course: v }).error === undefined;

describe("findAll.course — uchala shakl ham qabul qilinadi", () => {
  test.each([
    [3, "son"],
    ["3", "satr shaklidagi son"],
    [COURSE_ID, "ma'lumotnoma `_id` si"],
    ["all", '"hammasi" sentineli'],
  ])("%p (%s) -> qabul", (v) => {
    expect(okFindAll(v)).toBe(true);
  });

  test("`0` ham qabul qilinadi", () => {
    expect(okFindAll(0)).toBe(true);
  });

  test("tasodifiy satr RAD etiladi — jimgina `NaN` ga aylanmaydi", () => {
    expect(okFindAll("mag-1")).toBe(false);
    expect(okFindAll("hammasi")).toBe(false);
  });

  test("noto'g'ri uzunlikdagi hex RAD etiladi", () => {
    expect(okFindAll("69df7a8f94bda50c83a1d3")).toBe(false);
  });
});

describe("studentSchema — yozish yo'li", () => {
  const base = { fullName: "Test Talaba" };

  test("kurs SON bilan yoziladi (UI shu shaklni yuboradi)", () => {
    expect(studentSchema.validate({ ...base, course: 2 }).error).toBeUndefined();
  });

  test("kurs `_id` bilan ham yoziladi", () => {
    expect(studentSchema.validate({ ...base, course: COURSE_ID }).error).toBeUndefined();
  });

  test("`null` ruxsat (kurs belgilanmagan)", () => {
    expect(studentSchema.validate({ ...base, course: null }).error).toBeUndefined();
  });

  test("`courseId` ni MIJOZ yoza OLMAYDI — u serverda hosil qilinadi", () => {
    const { error } = studentSchema.validate({ ...base, courseId: COURSE_ID });
    expect(error).toBeDefined();
  });
});
