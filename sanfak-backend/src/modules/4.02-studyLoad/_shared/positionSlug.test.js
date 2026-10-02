"use strict";

const { resolvePositionSlug, KNOWN_SLUGS } = require("./positionSlug");

describe("resolvePositionSlug — DB'dagi haqiqiy lavozim nomlari", () => {
  test.each([
    ["Professor", "professor"],
    ["Dotsent", "docent"],
    ["Katta o'qituvchi", "senior_teacher"],
    ["Assistent", "assistant"],
    ["Stajyor o'qituvchi", "trainee"],
    ["Amaliyotchi (stajyor) o'qituvchi", "trainee"],
  ])("%s → %s", (title, slug) => {
    expect(resolvePositionSlug(title)).toBe(slug);
  });
});

describe("resolvePositionSlug — yozilish variantlari", () => {
  test("registr ahamiyatsiz", () => {
    expect(resolvePositionSlug("DOTSENT")).toBe("docent");
    expect(resolvePositionSlug("assistent")).toBe("assistant");
  });

  test("bosh/oxiridagi bo'shliq kesiladi", () => {
    expect(resolvePositionSlug("  Professor  ")).toBe("professor");
  });

  test("apostrof turlicha bo'lsa ham «Katta o'qituvchi» topiladi", () => {
    for (const t of ["Katta o'qituvchi", "Katta o’qituvchi", "Katta o‘qituvchi", "Katta oqituvchi"]) {
      expect(resolvePositionSlug(t)).toBe("senior_teacher");
    }
  });

  test("kirill variantlari ham qo'llanadi", () => {
    expect(resolvePositionSlug("Доцент")).toBe("docent");
    expect(resolvePositionSlug("Ассистент")).toBe("assistant");
  });

  test("to'liq lavozim nomi ichida uchrasa ham topiladi", () => {
    expect(resolvePositionSlug("Kafedra dotsenti")).toBe("docent");
  });
});

describe("resolvePositionSlug — xavfsiz default", () => {
  test.each([null, undefined, "", "   "])("%p → null", (v) => {
    expect(resolvePositionSlug(v)).toBeNull();
  });

  test("noma'lum lavozim → null (norma umumiy 360 ga tushadi)", () => {
    expect(resolvePositionSlug("Laborant")).toBeNull();
  });
});

describe("REGRESSION-GUARD — naqsh tartibi", () => {
  test("«Katta o'qituvchi» `assistant` ga TUSHMAYDI", () => {
    expect(resolvePositionSlug("Katta o'qituvchi")).not.toBe("assistant");
  });

  test("KNOWN_SLUGS — auditoriumHour kategoriyalari bilan bir xil to'plam", () => {
    expect([...KNOWN_SLUGS].sort()).toEqual(
      ["assistant", "docent", "professor", "senior_teacher", "trainee"].sort(),
    );
  });
});
