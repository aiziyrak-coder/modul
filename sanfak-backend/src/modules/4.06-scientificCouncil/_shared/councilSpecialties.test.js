const { specialtyCondition } = require("./councilSpecialties");

describe("_shared/councilSpecialties — specialtyCondition", () => {
  test("hech biri berilmasa — shart YO'Q (butun ro'yxat)", () => {
    expect(specialtyCondition(undefined, undefined)).toBeUndefined();
  });

  test("faqat shifr — to'g'ridan-to'g'ri tenglik", () => {
    expect(specialtyCondition("sp1", undefined)).toBe("sp1");
  });

  test("faqat kengash raqami — uning shifrlari bo'yicha `$in`", () => {
    expect(specialtyCondition(undefined, ["a", "b"])).toEqual({ $in: ["a", "b"] });
  });

  test("ikkalasi mos — KESISHMA aynan o'sha shifr", () => {
    expect(specialtyCondition("a", ["a", "b"])).toBe("a");
  });

  test("shifr raqamga tegishli EMAS — bo'sh natija, butun ro'yxat EMAS", () => {
    expect(specialtyCondition("z", ["a", "b"])).toEqual({ $in: [] });
  });

  test("ObjectId va satr aralash bo'lsa ham solishtiradi", () => {
    const asObjectLike = { toString: () => "a" };
    expect(specialtyCondition("a", [asObjectLike])).toBe("a");
  });

  test("kengash raqami bo'sh (shifrsiz raqam) — hech nima topilmaydi", () => {
    expect(specialtyCondition(undefined, [])).toEqual({ $in: [] });
  });
});
