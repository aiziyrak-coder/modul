const { BRANCHES } = require("./scienceBranches.seed");

describe("Fan tarmoqlari — OAK-2022 ro'yxati", () => {
  it("23 ta tarmoq (01–24, 20-raqam bo'sh)", () => {
    expect(BRANCHES).toHaveLength(23);
  });

  it("nom ham, shifr ham takrorlanmaydi", () => {
    const titles = BRANCHES.map(([, t]) => t.trim().toLowerCase());
    const codes = BRANCHES.map(([c]) => c);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("shifr NN.00.00 ko'rinishida", () => {
    BRANCHES.forEach(([code]) => expect(code).toMatch(/^\d{2}\.00\.00$/));
  });

  it("har bir nom bo'sh emas va ortiqcha bo'shliqsiz", () => {
    BRANCHES.forEach(([, title]) => {
      expect(title.length).toBeGreaterThan(3);
      expect(title).toBe(title.trim());
      expect(title).not.toMatch(/\s{2,}/);
    });
  });

  it("kirill harflari yo'q (lotin yozuvi)", () => {
    expect(BRANCHES.filter(([, t]) => /[А-Яа-яЎўҒғҚқҲҳЁё]/.test(t))).toEqual([]);
  });

  it("shifr tartibida — 20-raqam yo'q", () => {
    const codes = BRANCHES.map(([c]) => c);
    expect(codes).toEqual([...codes].sort());
    expect(codes).not.toContain("20.00.00");
    expect(codes[0]).toBe("01.00.00");
    expect(codes[codes.length - 1]).toBe("24.00.00");
  });

  it("4.10 formalarida ishlatiladigan tarmoqlar bor", () => {
    const byCode = Object.fromEntries(BRANCHES);
    expect(byCode["14.00.00"]).toBe("Tibbiyot fanlari");
    expect(byCode["15.00.00"]).toBe("Farmatsevtika fanlari");
    expect(byCode["03.00.00"]).toBe("Biologiya fanlari");
  });
});
