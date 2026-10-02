const service = require("./public.service");

describe("public.service — o'quv yillari", () => {
  test("sentyabrdan keyin joriy yil o'quv yilini boshlaydi", () => {
    const years = service.computeYears(new Date("2026-09-15T00:00:00Z"));
    expect(years).toContain("2026-2027");
    expect(years).toContain("2025-2026");
    expect(years).toContain("2027-2028");
  });

  test("sentyabrgacha bo'lgan oylar hali O'TGAN o'quv yiliga tegishli", () => {
    const years = service.computeYears(new Date("2026-08-23T00:00:00Z"));
    expect(years).toContain("2025-2026");
    expect(years).toContain("2026-2027");
    expect(years).not.toContain("2028-2029");
  });

  test("qaytgan qiymatlar modul formatida (YYYY-YYYY, defis)", () => {
    for (const y of service.computeYears(new Date("2026-01-10T00:00:00Z"))) {
      expect(y).toMatch(/^\d{4}-\d{4}$/);
    }
  });

  test("uchta ketma-ket yil qaytadi, takrorlanmaydi", () => {
    const years = service.computeYears(new Date("2026-10-01T00:00:00Z"));
    expect(years).toHaveLength(3);
    expect(new Set(years).size).toBe(3);
  });
});
