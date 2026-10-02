"use strict";

const { fmtNum, fmtDocDate } = require("./pdfFormat");

describe("fmtNum — kasr ajratgich vergul", () => {
  test("kasr → vergul: 0.5 → '0,5', 33.5 → '33,5', 0.25 → '0,25'", () => {
    expect(fmtNum(0.5)).toBe("0,5");
    expect(fmtNum(33.5)).toBe("33,5");
    expect(fmtNum(0.25)).toBe("0,25");
  });

  test("butun son o'zgarmaydi: 1 → '1', 29683 → '29683'", () => {
    expect(fmtNum(1)).toBe("1");
    expect(fmtNum(29683)).toBe("29683");
  });

  test("suzuvchi qoldiq 2 xonagacha yaxlitlanadi: 8.4 + 4.2 → '12,6'", () => {
    expect(fmtNum(8.4 + 4.2)).toBe("12,6");
  });

  test("son bo'lmagan qiymat — String() dek (matn, raqamli satr)", () => {
    expect(fmtNum("Anatomiya")).toBe("Anatomiya");
    expect(fmtNum("2.1")).toBe("2.1");
  });
});

describe("fmtDocDate — sana dd.mm.yyyy", () => {
  test("saqlangan 'dd/mm/yyyy' (toLocaleDateString uz-UZ) → 'dd.mm.yyyy'", () => {
    expect(fmtDocDate("23/09/2026")).toBe("23.09.2026");
    expect(fmtDocDate("3/9/2026")).toBe("03.09.2026");
  });

  test("Date obyekti → 'dd.mm.yyyy'; yaroqsiz Date → ''", () => {
    expect(fmtDocDate(new Date(2025, 11, 14))).toBe("14.12.2025");
    expect(fmtDocDate(new Date("x"))).toBe("");
  });

  test("allaqachon 'dd.mm.yyyy' — o'zgarmaydi; tanilmagan satr va null — o'zgarishsiz", () => {
    expect(fmtDocDate("25.11.2025")).toBe("25.11.2025");
    expect(fmtDocDate("2026-yil 3-sentabr")).toBe("2026-yil 3-sentabr");
    expect(fmtDocDate(null)).toBe("");
  });
});
