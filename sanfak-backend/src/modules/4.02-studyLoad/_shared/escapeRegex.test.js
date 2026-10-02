const escapeRegex = require("./escapeRegex");

describe("escapeRegex — asosiy xulq", () => {
  test("oddiy matn o'zgarmaydi", () => {
    expect(escapeRegex("Stomatologiya")).toBe("Stomatologiya");
  });

  test("bo'sh/undefined/null → bo'sh satr (chaqiruvchi qulashi shart emas)", () => {
    expect(escapeRegex("")).toBe("");
    expect(escapeRegex(undefined)).toBe("");
    expect(escapeRegex(null)).toBe("");
  });

  test("string bo'lmagan qiymat ham xavfsiz ishlanadi", () => {
    expect(escapeRegex(2026)).toBe("2026");
  });

  test("barcha metabelgilar ekranlanadi", () => {
    expect(escapeRegex(".*+?^${}()|[]\\")).toBe(
      "\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\",
    );
  });
});

describe("escapeRegex — RegExp bilan birga", () => {
  test("yolg'iz `(` SyntaxError bermaydi (ekranlanmasa berardi)", () => {
    expect(() => new RegExp("(", "i")).toThrow();
    expect(() => new RegExp(escapeRegex("("), "i")).not.toThrow();
  });

  test("metabelgi literal sifatida qidiriladi, operator sifatida emas", () => {
    const re = new RegExp(escapeRegex("O'quv (2026)"), "i");
    expect(re.test("O'quv (2026) reja")).toBe(true);
    expect(re.test("O'quv 2026 reja")).toBe(false);
  });

  test("`.` faqat nuqtaga mos keladi, istalgan belgiga emas", () => {
    const re = new RegExp(escapeRegex("4.2"), "i");
    expect(re.test("TZ 4.2 modul")).toBe(true);
    expect(re.test("TZ 442 modul")).toBe(false);
  });

  test("ReDoS namunasi literal bo'lib qoladi", () => {
    const evil = "(a+)+$";
    const re = new RegExp(escapeRegex(evil), "i");
    expect(re.source).not.toContain("(a+)+");
    expect(re.test("literal (a+)+$ matn")).toBe(true);
  });
});
