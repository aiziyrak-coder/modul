"use strict";

const GiftedStudent = require("./giftedStudent.model");

const ID = "6a7efdac5916905f06cebeac";

describe("giftedStudent.scoresByYear", () => {
  test("turi Map, sukut bo'yicha BO'SH (null emas)", () => {
    expect(GiftedStudent.schema.path("scoresByYear").instance).toBe("Map");
    expect(new GiftedStudent({ fullName: "X" }).toJSON().scoresByYear).toEqual({});
  });

  test("🔴 `/` kalitli qiymat validatsiyadan o'tadi", () => {
    const doc = new GiftedStudent({
      fullName: "X",
      scoresByYear: { "2025/2026": 80, "2026/2027": 312.5 },
    });
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.scoresByYear.get("2026/2027")).toBe(312.5);
  });

  test("🔴 `recalcTotal` ning AYNAN yozuvi kastlanadi", () => {
    const q = GiftedStudent.findByIdAndUpdate(ID, {
      totalScore: 392.5,
      scoresByYear: { "2025/2026": 80, "2026/2027": 312.5 },
    });
    expect(() => q.cast(GiftedStudent)).not.toThrow();
    expect(q.getUpdate()).toEqual({
      totalScore: 392.5,
      scoresByYear: { "2025/2026": 80, "2026/2027": 312.5 },
    });
  });

  test("`toJSON` xaritani ODDIY obyektga yoyadi — javob shakli odatdagidek", () => {
    const doc = new GiftedStudent({ fullName: "X", scoresByYear: { "2026/2027": 5 } });
    expect(JSON.parse(JSON.stringify(doc)).scoresByYear).toEqual({ "2026/2027": 5 });
  });

  test("son bo'lmagan qiymat RAD ETILADI", () => {
    const doc = new GiftedStudent({ fullName: "X", scoresByYear: { "2026/2027": "ko'p" } });
    expect(doc.validateSync()).toBeDefined();
  });

  test("`totalScore` TEGILMAGAN — umrbod yig'indi o'sha yerda qoladi", () => {
    const p = GiftedStudent.schema.path("totalScore");
    expect(p.instance).toBe("Number");
    expect(p.defaultValue).toBe(0);
  });
});
