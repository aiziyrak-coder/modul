const mongoose = require("mongoose");
const { academicYearLabel } = require("./academicYearLabel");

describe("academicYearLabel", () => {
  test("populate qilingan { title } obyektidan title qaytaradi", () => {
    const populated = { _id: new mongoose.Types.ObjectId(), title: "2025/2026" };
    expect(academicYearLabel(populated)).toBe("2025/2026");
  });

  test("xom (populate qilinmagan) ObjectId'da hex EMAS, fallback qaytaradi", () => {
    const raw = new mongoose.Types.ObjectId();
    expect(academicYearLabel(raw)).toBe("");
    expect(academicYearLabel(raw)).not.toBe(raw.toString());
  });

  test("xom ObjectId + maxsus fallback berilsa o'sha fallback qaytadi", () => {
    const raw = new mongoose.Types.ObjectId();
    expect(academicYearLabel(raw, "202_/202_")).toBe("202_/202_");
  });

  test("null bo'lsa standart fallback (bo'sh satr) qaytaradi", () => {
    expect(academicYearLabel(null)).toBe("");
  });

  test("null + maxsus fallback berilsa o'sha qaytadi", () => {
    expect(academicYearLabel(null, "—")).toBe("—");
  });

  test("undefined bo'lsa fallback qaytaradi", () => {
    expect(academicYearLabel(undefined, "—")).toBe("—");
  });

  test("title'siz obyektda \"[object Object]\" emas, fallback qaytaradi", () => {
    const noTitle = { _id: new mongoose.Types.ObjectId() };
    expect(academicYearLabel(noTitle, "—")).toBe("—");
    expect(academicYearLabel(noTitle, "—")).not.toContain("object Object");
  });

  test("xom legacy string (migratsiyadan oldingi format) fallback qaytaradi", () => {
    expect(academicYearLabel("2025-2026", "—")).toBe("—");
  });
});
