const COURSES = [
  { _id: "aaaaaaaaaaaaaaaaaaaaaa01", title: "1-kurs" },
  { _id: "aaaaaaaaaaaaaaaaaaaaaa02", title: "2-kurs" },
  { _id: "aaaaaaaaaaaaaaaaaaaaaa05", title: "5-kurs" },
];

jest.mock("#references/course/course.model", () => ({
  find: () => ({ select: () => ({ lean: async () => COURSES }) }),
}));

const {
  normalizeInput,
  normalizeList,
  numberFromTitle,
  clearCache,
} = require("./courseRefPlugin");

beforeEach(() => clearCache());

describe("numberFromTitle — ma'lumotnoma sarlavhasidan raqam", () => {
  test.each([
    ["1-kurs", 1],
    ["5-kurs", 5],
    ["10-kurs", 10],
  ])("%s -> %i", (title, n) => {
    expect(numberFromTitle(title)).toBe(n);
  });

  test.each(["Magistratura 1-kurs", "kurs", "", null, undefined])(
    "%p -> null (tanilmadi)",
    (v) => {
      expect(numberFromTitle(v)).toBeNull();
    },
  );
});

describe("normalizeInput — son va `_id` ikkalasi ham qabul qilinadi", () => {
  test("son -> raqam + ref", async () => {
    await expect(normalizeInput(2)).resolves.toEqual({
      number: 2,
      ref: "aaaaaaaaaaaaaaaaaaaaaa02",
    });
  });

  test("satr shaklidagi son ham ishlaydi", async () => {
    await expect(normalizeInput("5")).resolves.toEqual({
      number: 5,
      ref: "aaaaaaaaaaaaaaaaaaaaaa05",
    });
  });

  test("`_id` -> raqam ma'lumotnomadan olinadi", async () => {
    await expect(normalizeInput("aaaaaaaaaaaaaaaaaaaaaa01")).resolves.toEqual({
      number: 1,
      ref: "aaaaaaaaaaaaaaaaaaaaaa01",
    });
  });

  test("NOMA'LUM `_id` -> null, ya'ni qiymat O'ZGARTIRILMAYDI", async () => {
    await expect(normalizeInput("bbbbbbbbbbbbbbbbbbbbbb99")).resolves.toBeNull();
  });

  test("ma'lumotnomada yo'q SON -> raqam saqlanadi, ref `null`", async () => {
    await expect(normalizeInput(6)).resolves.toEqual({ number: 6, ref: null });
  });

  test.each([null, undefined, ""])("%p -> ikkalasi ham null", async (v) => {
    await expect(normalizeInput(v)).resolves.toEqual({ number: null, ref: null });
  });

  test("son bo'lmagan qiymat raqamga AYLANMAYDI", async () => {
    await expect(normalizeInput("mag-1")).resolves.toEqual({ number: null, ref: null });
  });
});

describe("normalizeList — `allowedCourses` uchun", () => {
  test("sonlar ro'yxati satr + ref ro'yxatiga bo'linadi", async () => {
    await expect(normalizeList(["1", "2"])).resolves.toEqual({
      list: ["1", "2"],
      refs: ["aaaaaaaaaaaaaaaaaaaaaa01", "aaaaaaaaaaaaaaaaaaaaaa02"],
    });
  });

  test("`_id` bilan berilsa satr ro'yxati RAQAMga keltiriladi", async () => {
    await expect(normalizeList(["aaaaaaaaaaaaaaaaaaaaaa05"])).resolves.toEqual({
      list: ["5"],
      refs: ["aaaaaaaaaaaaaaaaaaaaaa05"],
    });
  });

  test("ma'lumotnomada yo'q qiymat SATRDA qoladi, ref ro'yxatiga kirmaydi", async () => {
    await expect(normalizeList(["1", "mag-1"])).resolves.toEqual({
      list: ["1", "mag-1"],
      refs: ["aaaaaaaaaaaaaaaaaaaaaa01"],
    });
  });

  test("bo'sh/aniqlanmagan ro'yxat bo'sh natija beradi", async () => {
    await expect(normalizeList([])).resolves.toEqual({ list: [], refs: [] });
    await expect(normalizeList(undefined)).resolves.toEqual({ list: [], refs: [] });
  });
});
