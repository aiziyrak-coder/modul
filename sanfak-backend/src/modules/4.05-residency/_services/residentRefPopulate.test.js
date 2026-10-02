const mongoose = require("mongoose");
const {
  RESIDENT_REF_POPULATE,
} = require("#modules/4.05-residency/_services/residentRefPopulate");

const REF_MODEL = {
  specialty: "residencySpecialty",
  department: "department",
  group: "group",
};

describe("ichma-ich resident populate'i", () => {
  test("uchala yo'l ham qamralgan", () => {
    expect(RESIDENT_REF_POPULATE.map((p) => p.path).sort()).toEqual([
      "department",
      "group",
      "specialty",
    ]);
  });

  test.each(Object.entries(REF_MODEL))(
    "`%s` uchun model (%s) RO'YXATDAN O'TGAN",
    (path, model) => {
      expect(RESIDENT_REF_POPULATE.some((p) => p.path === path)).toBe(true);
      expect(mongoose.modelNames()).toContain(model);
    },
  );

  test("har bir yo'lda `select` bor — populate BUTUN hujjatni tortmasin", () => {
    for (const p of RESIDENT_REF_POPULATE) {
      expect(typeof p.select).toBe("string");
      expect(p.select.length).toBeGreaterThan(0);
    }
  });
});
