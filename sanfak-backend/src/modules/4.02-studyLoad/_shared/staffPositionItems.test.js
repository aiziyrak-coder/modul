const {
  findStaffItem,
  getOverallTotals,
  EMPTY_ITEM,
} = require("./staffPositionItems");

describe("findStaffItem — items[] bo'yicha qidiruv", () => {
  test("category+slug mos kelgan item topib qaytaradi", () => {
    const sp = {
      items: [
        { category: "teachingStaff", slug: "professor", positions: 2, load: 300, totalHours: 600 },
        { category: "teachingStaff", slug: "docent", positions: 3, load: 250, totalHours: 750 },
      ],
    };
    expect(findStaffItem(sp, "teachingStaff", "professor")).toEqual({
      positions: 2,
      load: 300,
      totalHours: 600,
      hourly: 0,
    });
  });

  test("topilmasa xavfsiz nol-default (EMPTY_ITEM) qaytaradi", () => {
    const sp = { items: [{ category: "teachingStaff", slug: "professor", positions: 2 }] };
    expect(findStaffItem(sp, "teachingStaff", "docent")).toEqual(EMPTY_ITEM);
  });

  test("items[] bo'sh bo'lganda xato bermaydi, default qaytaradi", () => {
    expect(findStaffItem({ items: [] }, "departmentHead", "professor")).toEqual(
      EMPTY_ITEM,
    );
  });

  test("sp yoki sp.items bo'lmasa ham qulamaydi (hozirgi V-B holat)", () => {
    expect(findStaffItem(null, "teachingStaff", "professor")).toEqual(EMPTY_ITEM);
    expect(findStaffItem(undefined, "teachingStaff", "professor")).toEqual(EMPTY_ITEM);
    expect(findStaffItem({}, "teachingStaff", "professor")).toEqual(EMPTY_ITEM);
  });

  test("noto'g'ri shakldagi item (array ichida null) o'tkazib yuboriladi", () => {
    const sp = { items: [null, { category: "supportStaff", slug: "laborant", positions: 1 }] };
    expect(findStaffItem(sp, "supportStaff", "laborant").positions).toBe(1);
  });

  test("son bo'lmagan maydonlar 0 ga tushadi (raqamga aylantirilmasa)", () => {
    const sp = {
      items: [{ category: "supportStaff", slug: "cabinetHead", positions: "abc", load: null, totalHours: undefined }],
    };
    expect(findStaffItem(sp, "supportStaff", "cabinetHead")).toEqual({
      positions: 0,
      load: 0,
      totalHours: 0,
      hourly: 0,
    });
  });
});

describe("getOverallTotals — hujjat darajasidagi tayyor jami", () => {
  test("totalPositions va hourly to'g'ri o'qiladi", () => {
    expect(getOverallTotals({ totalPositions: 2, hourly: 60 })).toEqual({
      totalPositions: 2,
      hourly: 60,
    });
  });

  test("items[] bo'sh bo'lsa ham totalPositions/hourly to'g'ri qaytadi (bog'liq emas)", () => {
    expect(
      getOverallTotals({ items: [], totalPositions: 1, hourly: 280 }),
    ).toEqual({ totalPositions: 1, hourly: 280 });
  });

  test("sp bo'lmasa yoki maydonlar yo'q bo'lsa nolga tushadi (xato bermaydi)", () => {
    expect(getOverallTotals(null)).toEqual({ totalPositions: 0, hourly: 0 });
    expect(getOverallTotals(undefined)).toEqual({ totalPositions: 0, hourly: 0 });
    expect(getOverallTotals({})).toEqual({ totalPositions: 0, hourly: 0 });
  });
});

describe("averageLoad — O'quv yuklama guruh jami (o'rtacha)", () => {
  const { averageLoad } = require("./staffPositionItems");
  test("12600 soat / 16 ish o'rni → 787.5 → 788", () => {
    expect(averageLoad(12600, 16)).toBe(788);
  });
  test("butun songa yaxlitlanadi; ish o'rni 0 → 0", () => {
    expect(averageLoad(1000, 3)).toBe(333);
    expect(averageLoad(2086, 108)).toBe(19);
    expect(averageLoad(166, 12)).toBe(14);
    expect(averageLoad(1000, 0)).toBe(0);
    expect(averageLoad(undefined, undefined)).toBe(0);
  });
  test("sumHourly — items[].hourly yig'indisi (bo'sh/yo'q → 0)", () => {
    const { sumHourly } = require("./staffPositionItems");
    expect(sumHourly({ items: [{ hourly: 40 }, { hourly: 25 }, {}] })).toBe(65);
    expect(sumHourly({ items: [] })).toBe(0);
    expect(sumHourly(undefined)).toBe(0);
  });
  test("findStaffItem `hourly` ni o'qiydi", () => {
    const sp = { items: [{ category: "teachingStaff", slug: "docent", positions: 1, load: 1, totalHours: 1, hourly: 45 }] };
    expect(findStaffItem(sp, "teachingStaff", "docent").hourly).toBe(45);
  });
});
