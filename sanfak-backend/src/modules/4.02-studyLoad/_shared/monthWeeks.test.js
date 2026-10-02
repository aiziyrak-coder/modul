const {
  monthCounts,
  totalWeeks,
  validateCounts,
  redistributeMonths,
  equalCounts,
  planCourses,
  buildCoursesUpdate,
} = require("./monthWeeks");

const MONTHS = [
  "Sentabr", "Oktabr", "Noyabr", "Dekabr", "Yanvar", "Fevral",
  "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust",
];
const LIVE = [5, 4, 5, 4, 5, 4, 5, 4, 4, 4, 4, 4];

const course = (counts = LIVE, over = {}) => {
  const keyOf = (n) => (n === 1 ? "K" : [16, 17].includes(n) ? "A" : [18, 19, 52].includes(n) ? "T" : " ");
  const months = [];
  let n = 1;
  MONTHS.forEach((month, i) => {
    const weeks = [];
    for (let k = 0; k < counts[i]; k++) {
      weeks.push({ week: n, key: keyOf(n) });
      n += 1;
    }
    months.push({ month, weeks });
  });
  const weeks = {};
  for (let w = 1; w <= 52; w++) weeks[String(w)] = keyOf(w);
  return { _id: "c1", course: "I", months, weeks, total: 41, ...over };
};

const counts = (arr) => MONTHS.map((month, i) => ({ month, count: arr[i] }));

describe("monthCounts / totalWeeks", () => {
  test("jonli hujjat → 12 oy, jami 52", () => {
    expect(monthCounts(course()).map((m) => m.count)).toEqual(LIVE);
    expect(totalWeeks(course())).toBe(52);
  });
  test("months yo'q → bo'sh / 0", () => {
    expect(monthCounts({})).toEqual([]);
    expect(totalWeeks(null)).toBe(0);
  });
});

describe("validateCounts — I1/I2/I3", () => {
  test("to'g'ri kirish — normallashtirilgan ro'yxat qaytadi", () => {
    const out = validateCounts(course(), counts(LIVE));
    expect(out).toHaveLength(12);
    expect(out[0]).toEqual({ month: "Sentabr", count: 5 });
  });
  test("I2: yig'indi 52 emas → 400 (matnda kutilgan va hozirgi)", () => {
    const bad = counts([4, 4, 5, 4, 5, 4, 5, 4, 4, 4, 4, 4]);
    expect(() => validateCounts(course(), bad)).toThrow(/52 bo'lishi kerak \(hozir 51\)/);
  });
  test("I3: 0 yoki kasr → 400", () => {
    expect(() => validateCounts(course(), counts([0, 9, 5, 4, 5, 4, 5, 4, 4, 4, 4, 4]))).toThrow(/kamida 1/);
    expect(() => validateCounts(course(), counts([5.5, 3.5, 5, 4, 5, 4, 5, 4, 4, 4, 4, 4]))).toThrow(/butun/);
  });
  test("I1: oylar soni / nomi mos emas → 400; apostrof/registr farqi XATO EMAS", () => {
    expect(() => validateCounts(course(), counts(LIVE).slice(0, 11))).toThrow(/oylar soni mos emas/);
    const renamed = counts(LIVE);
    renamed[2] = { month: "Dekabr", count: 5 };
    expect(() => validateCounts(course(), renamed)).toThrow(/3-oy nomi mos emas/);
    const c = course();
    c.months[0].month = "SENTABR ";
    expect(() => validateCounts(c, counts(LIVE))).not.toThrow();
  });
  test("months yo'q hujjat → 400 (faylni qayta yuklash)", () => {
    expect(() => validateCounts({ months: [] }, counts(LIVE))).toThrow(/taqsimoti yo'q/);
  });
  test("kurs belgisi xato matnida", () => {
    expect(() => validateCounts(course(), counts([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]), "II kurs")).toThrow(/^II kurs: /);
  });
});

describe("redistributeMonths — I4/I5", () => {
  test("Sentabr 5→4, Oktabr 4→5: hafta raqamlari 1..52 ketma-ket, harflar o'z raqamida", () => {
    const next = counts([4, 5, 5, 4, 5, 4, 5, 4, 4, 4, 4, 4]);
    const out = redistributeMonths(course(), next);
    expect(out.map((m) => m.weeks.length)).toEqual([4, 5, 5, 4, 5, 4, 5, 4, 4, 4, 4, 4]);
    const flat = out.flatMap((m) => m.weeks);
    expect(flat.map((w) => w.week)).toEqual(Array.from({ length: 52 }, (_, i) => i + 1));
    expect(out[1].weeks[0]).toEqual({ week: 5, key: " " });
    expect(flat.find((w) => w.week === 1).key).toBe("K");
    expect(flat.find((w) => w.week === 16).key).toBe("A");
    expect(flat.find((w) => w.week === 52).key).toBe("T");
    expect(new Set(flat.map((w) => w.week)).size).toBe(52);
  });

  test("`weeks` Map (Mongoose) ham o'qiladi; Map'da yo'q hafta eski months'dan", () => {
    const c = course();
    c.weeks = new Map(Object.entries(c.weeks));
    c.weeks.delete("52");
    const out = redistributeMonths(c, counts(LIVE));
    const flat = out.flatMap((m) => m.weeks);
    expect(flat.find((w) => w.week === 1).key).toBe("K");
    expect(flat.find((w) => w.week === 52).key).toBe("T");
  });

  test("kirish o'zgartirilmaydi (sof)", () => {
    const c = course();
    const snapshot = JSON.stringify(c);
    redistributeMonths(c, counts([4, 5, 5, 4, 5, 4, 5, 4, 4, 4, 4, 4]));
    expect(JSON.stringify(c)).toBe(snapshot);
  });
});

describe("equalCounts — parser fallback formulasi", () => {
  test("52/12 → 5,5,5,5,4,4,4,4,4,4,4,4", () => {
    expect(equalCounts(MONTHS, 52).map((m) => m.count)).toEqual([5, 5, 5, 5, 4, 4, 4, 4, 4, 4, 4, 4]);
  });
  test("48/12 → hammasi 4", () => {
    expect(equalCounts(MONTHS, 48).every((m) => m.count === 4)).toBe(true);
  });
});

describe("planCourses / buildCoursesUpdate", () => {
  test("har kurs uchun months; $set + arrayFilters kurs _id bo'yicha, faqat months (I5)", () => {
    const c1 = course(LIVE, { _id: "c1", course: "I" });
    const c2 = course(LIVE, { _id: "c2", course: "II" });
    const plans = planCourses([c1, c2], counts([4, 5, 5, 4, 5, 4, 5, 4, 4, 4, 4, 4]));
    expect(plans.map((p) => p._id)).toEqual(["c1", "c2"]);
    const { update, arrayFilters } = buildCoursesUpdate(plans);
    expect(Object.keys(update.$set)).toEqual(["courses.$[c0].months", "courses.$[c1].months"]);
    expect(arrayFilters).toEqual([{ "c0._id": "c1" }, { "c1._id": "c2" }]);
    expect(update.$set["courses.$[c0].months"][1].weeks).toHaveLength(5);
  });
  test("kurslardan biri mos kelmasa — xato kurs belgisi bilan", () => {
    const c2 = course(LIVE, { _id: "c2", course: "II" });
    c2.months = c2.months.slice(0, 11);
    expect(() => planCourses([course(), c2], counts(LIVE))).toThrow(/^II kurs: oylar soni/);
  });
});
