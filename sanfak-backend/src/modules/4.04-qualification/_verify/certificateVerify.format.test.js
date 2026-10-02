const {
  fmtDate,
  fmtPeriod,
  fmtForm,
  fmtHours,
} = require("./certificateVerify.controller");

describe("certificateVerify.controller — formatlash", () => {
  describe("fmtDate", () => {
    test("sanani dd.mm.yyyy ko'rinishida beradi", () => {
      expect(fmtDate(new Date(2026, 6, 14))).toBe("14.07.2026");
    });

    test("bir xonali kun/oy nol bilan to'ldiriladi", () => {
      expect(fmtDate(new Date(2026, 0, 5))).toBe("05.01.2026");
    });

    test("bo'sh/noto'g'ri qiymat bo'sh satr", () => {
      expect(fmtDate(null)).toBe("");
      expect(fmtDate(undefined)).toBe("");
      expect(fmtDate("salom")).toBe("");
    });
  });

  describe("fmtPeriod", () => {
    test("ikki sana tire bilan birlashadi", () => {
      expect(fmtPeriod(new Date(2026, 4, 12), new Date(2026, 6, 14))).toBe(
        "12.05.2026 — 14.07.2026",
      );
    });

    test("faqat bitta sana bo'lsa — o'sha ko'rsatiladi", () => {
      expect(fmtPeriod(new Date(2026, 4, 12), null)).toBe("12.05.2026");
      expect(fmtPeriod(null, new Date(2026, 6, 14))).toBe("14.07.2026");
    });

    test("ikkalasi ham yo'q — bo'sh satr (maydon chizilmaydi)", () => {
      expect(fmtPeriod(null, null)).toBe("");
    });
  });

  describe("fmtForm", () => {
    test("1 -> Onlayn, 2 -> Oflayn (qualCourse.model bilan bir xil)", () => {
      expect(fmtForm(1)).toBe("Onlayn");
      expect(fmtForm(2)).toBe("Oflayn");
    });

    test("noma'lum qiymat bo'sh satr", () => {
      expect(fmtForm(0)).toBe("");
      expect(fmtForm(null)).toBe("");
      expect(fmtForm(9)).toBe("");
    });
  });

  describe("fmtHours", () => {
    test("soat qo'shimchasi bilan", () => {
      expect(fmtHours(72)).toBe("72 soat");
    });

    test("0/null — bo'sh satr", () => {
      expect(fmtHours(0)).toBe("");
      expect(fmtHours(null)).toBe("");
    });
  });
});
