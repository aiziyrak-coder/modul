const { staffTableMissing, carryOverStaffItems } = require("./workload.staffGate");

describe("staffTableMissing (D-11)", () => {
  test("ish o'rni kutiladi, lekin lavozimlarga kiritilmagan — to'siq", () => {
    expect(staffTableMissing({ totalPositions: 3, items: [] })).toBe(true);
    expect(staffTableMissing({ totalPositions: 3, items: [{ slug: "assistant", positions: 0 }] })).toBe(true);
  });

  test("lavozimga ish o'rni kiritilgan — o'tadi", () => {
    expect(staffTableMissing({ totalPositions: 3, items: [{ slug: "assistant", positions: 2 }] })).toBe(false);
  });

  test("faqat soatbay (totalPositions 0) yoki staffPositions yo'q — bo'sh Jadval 2 qonuniy", () => {
    expect(staffTableMissing({ totalPositions: 0, items: [] })).toBe(false);
    expect(staffTableMissing(undefined)).toBe(false);
  });
});

describe("carryOverStaffItems (D-11)", () => {
  test("oldingi versiya qatorlari `_id`siz ko'chadi", () => {
    const items = [{ _id: "x1", slug: "docent", title: "Dotsent", positions: 1.5, load: 350 }];
    expect(carryOverStaffItems(items)).toEqual([{ slug: "docent", title: "Dotsent", positions: 1.5, load: 350 }]);
  });

  test("yo'q/bo'sh — bo'sh massiv", () => {
    expect(carryOverStaffItems(undefined)).toEqual([]);
  });
});
