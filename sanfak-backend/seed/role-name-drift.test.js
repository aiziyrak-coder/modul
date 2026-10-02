const { check } = require("../scripts/check-role-drift");

describe("Rol-nomi drift qopqoni (F-8, §7.1)", () => {
  test("skanerlangan rol nomlari bor (sanity — manba fayllar to'g'ri yuklandi)", () => {
    const { scannedTitleCount } = check();
    expect(scannedTitleCount).toBeGreaterThan(10);
  });

  test("seed yozgan har bir rol nomi constants.ROLES da bor", () => {
    const { unknown } = check();
    expect(unknown).toEqual([]);
  });

  test.each(["malaka_oqituvchi", "malaka_tinglovchi"])(
    "%s endi constants.ROLES da bor (F-8 add-only qo'shildi)",
    (title) => {
      const { ROLES } = require("../src/config/constants");
      expect(Object.values(ROLES)).toContain(title);
    },
  );
});
