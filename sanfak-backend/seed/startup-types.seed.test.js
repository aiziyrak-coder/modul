const { TYPES, missingTypes, extraTypes, norm } = require("./startup-types.seed");

describe("Startap loyiha turlari — ro'yxat", () => {
  it("to'rtta tur", () => {
    expect(TYPES).toEqual([
      "Ilmiy loyiha",
      "Amaliy loyiha",
      "Startap tanlov",
      "Xalqaro loyiha",
    ]);
  });

  it("takrorlanmaydi", () => {
    const n = TYPES.map(norm);
    expect(new Set(n).size).toBe(n.length);
  });
});

describe("missingTypes", () => {
  it("bo'sh lug'atda hammasi qo'shiladi", () => {
    expect(missingTypes([])).toEqual(TYPES);
  });

  it("mavjud nom o'tkazib yuboriladi (registr/bo'shliq farqi hisobga olinmaydi)", () => {
    expect(missingTypes(["  ILMIY   LOYIHA "])).not.toContain("Ilmiy loyiha");
  });

  it("hammasi bor bo'lsa — bo'sh", () => {
    expect(missingTypes(TYPES)).toEqual([]);
  });
});

describe("extraTypes", () => {
  it("ro'yxatdagi tur ortiqcha emas", () => {
    expect(extraTypes(TYPES.map((name) => ({ name })))).toEqual([]);
  });

  it("ro'yxatda yo'q tur ORTIQCHA", () => {
    const doc = { name: "Ijtimoiy startap" };
    expect(extraTypes([doc])).toEqual([doc]);
  });

  it("bo'sh lug'atda ortiqcha yo'q", () => {
    expect(extraTypes([])).toEqual([]);
  });
});
