const { buildFilter } = require("./task.service");

const ME = "6a7da70157df92f4847a95a5";
const OTHER = "6a7da70157df92f4847a95a7";

describe("buildFilter — biriktirilganlar doirasi (`{assignee: me}`)", () => {
  test("o'z id'si bilan filtrlash — doira saqlanadi", () => {
    const f = buildFilter({ assignee: ME }, { assignee: ME });
    expect(f.assignee).toBe(ME);
  });

  test("BEGONA id — natija bo'sh, doira ALMASHMAYDI", () => {
    const f = buildFilter({ assignee: ME }, { assignee: OTHER });
    expect(f.assignee).toEqual({ $in: [] });
    expect(f.assignee).not.toBe(OTHER);
  });

  test("`assignee` berilmasa doira o'z holicha qoladi", () => {
    const f = buildFilter({ assignee: ME }, {});
    expect(f.assignee).toBe(ME);
  });

  test("qo'shimcha filtrlar bilan birga ham doira saqlanadi", () => {
    const f = buildFilter(
      { assignee: ME },
      { assignee: OTHER, priority: "high", category: "cat1" },
    );
    expect(f.assignee).toEqual({ $in: [] });
    expect(f.priority).toBe("high");
    expect(f.category).toBe("cat1");
  });

  test("`search` bilan birga — `assignee` guard'i saqlanadi", () => {
    const f = buildFilter({ assignee: ME }, { assignee: OTHER, search: "hisobot" });
    expect(f.assignee).toEqual({ $in: [] });
    expect(f.$or).toBeDefined();
  });
});

describe("buildFilter — `assignee` TIPI (aggregate cast qilmaydi)", () => {
  const { Types } = require("mongoose");

  it("to'g'ri shakldagi id ObjectId'ga aylantiriladi", () => {
    const f = buildFilter({ createdBy: ME }, { assignee: OTHER });
    expect(f.assignee).toBeInstanceOf(Types.ObjectId);
    expect(String(f.assignee)).toBe(OTHER);
  });

  it.each(["abc", "abcdefghijkl", "6a7da70157df92f4847a95a"])(
    "noto'g'ri shakl (%p) TEGILMAYDI",
    (bad) => {
      const f = buildFilter({ createdBy: ME }, { assignee: bad });
      expect(typeof f.assignee).toBe("string");
      expect(f.assignee).toBe(bad);
    },
  );

  it("doira ichidagi mos kelishda ham ObjectId qoladi", () => {
    const oid = new Types.ObjectId(ME);
    const f = buildFilter({ assignee: oid }, { assignee: ME });
    expect(f.assignee).toBeInstanceOf(Types.ObjectId);
  });
});

describe("buildFilter — yaratganlar doirasi (`{createdBy: me}`) BUZILMAYDI", () => {
  test("rahbar o'z topshirig'ini ijrochi bo'yicha filtrlaydi", () => {
    const f = buildFilter({ createdBy: ME }, { assignee: OTHER });
    expect(f.createdBy).toBe(ME);
    expect(String(f.assignee)).toBe(OTHER);
  });

  test("cheklovsiz doira (global rol) — filtr erkin", () => {
    const f = buildFilter({}, { assignee: OTHER });
    expect(String(f.assignee)).toBe(OTHER);
  });
});
