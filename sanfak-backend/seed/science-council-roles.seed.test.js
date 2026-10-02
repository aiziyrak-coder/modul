const {
  rolesDef,
  MANAGED_SECTIONS,
  mergePermissions,
} = require("./science-council-roles.seed");
const { ROLES, MODULES, ACTIONS } = require("../src/config/constants");

const permsOf = (title) =>
  rolesDef.find((r) => r.title === title)?.permissions || [];

const actionsFor = (title, section) =>
  permsOf(title).find((p) => p.section === section)?.actionKeys || [];

describe("4.06 seed ↔ route gate mosligi", () => {
  test.each([
    [ROLES.ILMIY_KENGASH_KOTIBI],
    [ROLES.ILMIY_KENGASH_AZOSI],
    [ROLES.OQITUVCHI],
  ])(
    "%s ilmiy ishlar RO'YXATINI ocha oladi (scientificWork:readAll)",
    (title) => {
      expect(actionsFor(title, MODULES.SCIENTIFIC_WORK)).toContain(
        ACTIONS.READ_ALL,
      );
    },
  );

  test("REGRESSIYA: oqituvchi'da to'liq CRUD-o'qish to'plami bor", () => {
    expect(actionsFor(ROLES.OQITUVCHI, MODULES.SCIENTIFIC_WORK)).toEqual(
      expect.arrayContaining([
        ACTIONS.CREATE,
        ACTIONS.READ,
        ACTIONS.READ_ALL,
        ACTIONS.UPDATE,
      ]),
    );
  });

  test("a'zo ilmiy ishga to'g'ridan-to'g'ri qaror qila oladi (scientificWork:approve)", () => {
    expect(actionsFor(ROLES.ILMIY_KENGASH_AZOSI, MODULES.SCIENTIFIC_WORK)).toContain(
      ACTIONS.APPROVE,
    );
  });
});

describe("4.06 imtiyoz chegaralari (403 ni scope kengaytirib 'tuzatmaslik')", () => {
  test.each([[ROLES.ILMIY_KENGASH_AZOSI], [ROLES.OQITUVCHI]])(
    "%s `scopeLevel: self` bo'lib qoladi",
    (title) => {
      expect(rolesDef.find((r) => r.title === title).scopeLevel).toBe("self");
    },
  );

  test("oqituvchi ilmiy ishni o'chira/tasdiqlay/imzolay olmaydi", () => {
    const acts = actionsFor(ROLES.OQITUVCHI, MODULES.SCIENTIFIC_WORK);
    expect(acts).not.toContain(ACTIONS.DELETE);
    expect(acts).not.toContain(ACTIONS.APPROVE);
    expect(acts).not.toContain(ACTIONS.SIGN);
  });

  test("dalolatnomani faqat kotib imzolaydi (workDecision:sign)", () => {
    expect(
      actionsFor(ROLES.ILMIY_KENGASH_KOTIBI, MODULES.WORK_DECISION),
    ).toContain(ACTIONS.SIGN);
    expect(
      actionsFor(ROLES.ILMIY_KENGASH_AZOSI, MODULES.WORK_DECISION),
    ).not.toContain(ACTIONS.SIGN);
  });
});

describe("non-destructive MERGE", () => {
  test("boshqa modul section'lari saqlanadi, 4.6 niki almashtiriladi", () => {
    const existing = [
      { section: "workload", actionKeys: [ACTIONS.READ] },
      { section: MODULES.SCIENTIFIC_WORK, actionKeys: [ACTIONS.READ] },
    ];
    const merged = mergePermissions(existing, permsOf(ROLES.OQITUVCHI));
    const sections = merged.map((p) => p.section);

    expect(sections).toContain("workload");
    expect(
      merged.find((p) => p.section === MODULES.SCIENTIFIC_WORK).actionKeys,
    ).toContain(ACTIONS.READ_ALL);
    expect(sections.filter((s) => s === MODULES.SCIENTIFIC_WORK)).toHaveLength(
      1,
    );
  });

  test("rolesDef dagi har bir section MANAGED_SECTIONS ichida", () => {
    for (const role of rolesDef) {
      for (const p of role.permissions) {
        expect(MANAGED_SECTIONS.has(p.section)).toBe(true);
      }
    }
  });
});
