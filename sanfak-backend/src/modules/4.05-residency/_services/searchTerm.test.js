const {
  normalizeSearchTerm,
  searchRegex,
  searchOr,
} = require("./searchTerm");

describe("normalizeSearchTerm", () => {
  it("bosh va oxirgi bo'shliqlarni olib tashlaydi", () => {
    expect(normalizeSearchTerm("  apple  ")).toBe("apple");
  });

  it("ichkaridagi ketma-ket bo'shliqlarni bittaga siqadi", () => {
    expect(normalizeSearchTerm("Karimov   Aziz")).toBe("Karimov Aziz");
  });

  it("bo'sh, faqat bo'shliq, undefined va null uchun bo'sh satr", () => {
    expect(normalizeSearchTerm("")).toBe("");
    expect(normalizeSearchTerm("   ")).toBe("");
    expect(normalizeSearchTerm(undefined)).toBe("");
    expect(normalizeSearchTerm(null)).toBe("");
  });
});

describe("searchRegex", () => {
  it("bo'sh so'rovda null qaytaradi — filtr QO'YILMAYDI", () => {
    expect(searchRegex("")).toBeNull();
    expect(searchRegex("   ")).toBeNull();
    expect(searchRegex(undefined)).toBeNull();
  });

  it("registrga sezgir emas", () => {
    expect(searchRegex("apple").$options).toBe("i");
  });

  it("qism-satr bo'yicha qidiradi — anchor QO'YMAYDI", () => {
    const { $regex } = searchRegex("app");
    expect($regex).toBe("app");
    expect($regex.startsWith("^")).toBe(false);
    expect($regex.endsWith("$")).toBe(false);
  });

  it("regex metakarakterlarini escape qiladi", () => {
    expect(searchRegex("(").$regex).toBe("\\(");
    expect(searchRegex("[").$regex).toBe("\\[");
    expect(searchRegex("+").$regex).toBe("\\+");
    expect(searchRegex("\\").$regex).toBe("\\\\");
    expect(searchRegex(".*").$regex).toBe("\\.\\*");
  });

  it("escape qilingan naqsh haqiqiy JS regex sifatida kompilyatsiya bo'ladi", () => {
    for (const raw of ["(", "[", "+", "*", "?", "\\", "a{9999}{9999}", "^$|"]) {
      expect(() => new RegExp(searchRegex(raw).$regex)).not.toThrow();
    }
  });

  it("escape qilingan naqsh LITERAL matnga mos keladi", () => {
    const rx = new RegExp(searchRegex("Anatomiya (atlas)").$regex, "i");
    expect(rx.test("Klinik Anatomiya (atlas) 2-nashr")).toBe(true);
    expect(rx.test("Anatomiya atlas")).toBe(false);
  });

  it("`%` va `_` ni buzmaydi — ular regexda maxsus emas", () => {
    expect(new RegExp(searchRegex("50%").$regex).test("Bar 50% off")).toBe(true);
    expect(new RegExp(searchRegex("_").$regex).test("under_score")).toBe(true);
  });

  it("kirill va o'zbek-kirill matnini o'zgartirmasdan uzatadi", () => {
    expect(searchRegex("  Тошкент  ").$regex).toBe("Тошкент");
    expect(searchRegex("ЎЗБЕКИСТОН").$regex).toBe("ЎЗБЕКИСТОН");
  });
});

describe("searchOr", () => {
  it("har bir maydon uchun bitta shox quradi", () => {
    expect(searchOr("ali", ["fullName", "jshshir"])).toEqual([
      { fullName: { $regex: "ali", $options: "i" } },
      { jshshir: { $regex: "ali", $options: "i" } },
    ]);
  });

  it("bo'sh so'rovda yoki maydonsiz null qaytaradi", () => {
    expect(searchOr("  ", ["fullName"])).toBeNull();
    expect(searchOr("ali", [])).toBeNull();
  });
});
