const { GRANTS } = require("./residency-roles.seed");
const { MODULES, ACTIONS } = require("../src/config/constants");

const FOUR_ROLES = [
  "magistratura_bolim",
  "klinik_ustoz",
  "ilmiy_rahbar",
  "kafedra_mudiri",
];

describe("4.5 seed — user section granti (D-051 / D-083)", () => {
  test.each(FOUR_ROLES)(
    "%s: user:search bor (lookup ochiladi)",
    (title) => {
      expect(GRANTS[title][MODULES.USER]).toContain(ACTIONS.SEARCH);
    },
  );

  test.each(FOUR_ROLES)(
    "%s: user:readAll YO'Q (landing /admin/users tuzog'i yopiq)",
    (title) => {
      expect(GRANTS[title][MODULES.USER]).not.toContain(ACTIONS.READ_ALL);
    },
  );

  test.each(FOUR_ROLES)("%s: user:read ham YO'Q (grant torayishi)", (title) => {
    expect(GRANTS[title][MODULES.USER]).not.toContain(ACTIONS.READ);
  });

  test.each(FOUR_ROLES)(
    "%s: user section aynan bitta action (search) — kengaytirilmagan",
    (title) => {
      expect(GRANTS[title][MODULES.USER]).toEqual([ACTIONS.SEARCH]);
    },
  );
});

describe("4.5 seed — residentAttendance:approve (EXC-Q1 / D-18)", () => {
  test("magistratura_bolim: approve BOR (Jurnal «Sababli qilish»)", () => {
    expect(GRANTS.magistratura_bolim[MODULES.RESIDENT_ATTENDANCE]).toContain(ACTIONS.APPROVE);
  });

  test.each(["klinik_ustoz", "ilmiy_rahbar", "kafedra_mudiri", "rezident", "magistrant", "rektor"])(
    "%s: approve YO'Q",
    (title) => {
      expect(GRANTS[title]).toBeDefined();
      expect(GRANTS[title][MODULES.RESIDENT_ATTENDANCE] ?? []).not.toContain(ACTIONS.APPROVE);
    },
  );
});
