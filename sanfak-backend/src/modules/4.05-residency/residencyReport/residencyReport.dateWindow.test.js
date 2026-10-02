"use strict";

const service = require("./residencyReport.service");
const { attendanceDateMatch, academicYearRange } = service;

describe("attendanceDateMatch — «berilmagan» = «chegarasiz»", () => {
  test("🔴 o'quv yili YO'Q — sana sharti UMUMAN qo'yilmaydi", () => {
    expect(attendanceDateMatch({})).toEqual({});
    expect(attendanceDateMatch({ academicYear: "" })).toEqual({});
    expect(attendanceDateMatch({ academicYear: null })).toEqual({});
    expect(attendanceDateMatch({ academicYearTitle: "" })).toEqual({});
  });

  test("🔴 natijada `date` KALITI bo'lmaydi (nafaqat keng oraliq)", () => {
    expect(Object.keys(attendanceDateMatch({}))).toHaveLength(0);
  });

  test("o'quv yili berilgan — sentabr..avgust oynasi (ikkala imloda ham)", () => {
    const slash = attendanceDateMatch({ academicYearTitle: "2025/2026" });
    const dash = attendanceDateMatch({ academicYear: "2025-2026" });

    expect(slash).toEqual(dash);
    expect(slash.date.$gte.toISOString()).toBe("2025-09-01T00:00:00.000Z");
    expect(slash.date.$lte.toISOString()).toBe("2026-08-31T23:59:59.000Z");
  });

  test("`academicYearTitle` ustun turadi", () => {
    const m = attendanceDateMatch({
      academicYearTitle: "2024/2025",
      academicYear: "2025-2026",
    });
    expect(m.date.$gte.toISOString()).toBe("2024-09-01T00:00:00.000Z");
  });

  test("🔴 tanib bo'lmaydigan titul — 12 oyga TUSHMAYDI, chegarasiz qoladi", () => {
    expect(attendanceDateMatch({ academicYear: "2025-2026 o'quv yili" })).toEqual({});
    expect(attendanceDateMatch({ academicYear: "all" })).toEqual({});
  });
});

describe("academicYearRange — o'zgarmagan (boshqa iste'molchilar uchun)", () => {
  test("yil berilsa avvalgidek oraliq beradi", () => {
    const { from, to } = academicYearRange("2025/2026");
    expect(from.toISOString()).toBe("2025-09-01T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-08-31T23:59:59.000Z");
  });

  test("yil berilmasa hamon 12 oylik oyna qaytaradi", () => {
    const now = new Date("2026-09-02T00:00:00.000Z");
    const { from, to } = academicYearRange("", now);
    expect(to).toBe(now);
    expect(from.toISOString()).toBe("2025-10-01T00:00:00.000Z");
  });
});
