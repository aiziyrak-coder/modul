const { loadAll } = require("./_role-seed-inventory");
const { MODULES } = require("../src/config/constants");
const { NOTIFICATION_ACTIONS } = require("./_module-permission-lib");

function computeMissingRoles() {
  const { grants } = loadAll();
  const notifRoles = new Set(
    grants.filter((g) => g.section === MODULES.NOTIFICATION).map((g) => g.title),
  );
  const anyGrantRoles = new Set(grants.map((g) => g.title));
  return [...anyGrantRoles].filter((t) => !notifRoles.has(t)).sort();
}

const EXPECTED_BASELINE_TARGETS = [
  "arm",
  "fakultet_kengash_kotibi",
  "hakam",
  "ichki_nazorat",
  "ilmiy_rahbar",
  "iqtidorli_bolim",
  "kadrlar",
  "kafedra_ilmiy_masul",
  "kafedra_uslubiy_masul",
  "kafedra_ustoz_shogird_masul",
  "klinik_ustoz",
  "magistrant",
  "magistratura_bolim",
  "moderator",
  "oquv_uslubiy_boshqarma",
  "qabul_bolimi",
  "reja_moliya",
  "rezident",
  "talaba",
  "talim_sifati_nazorati",
];

const INTENTIONALLY_EXCLUDED_ZERO_GRANT = {
  tashqi_tadqiqotchi:
    "science-council-roles.seed.js §4: ATAYLAB permissiyasiz placeholder " +
    "(kabinet UI hali qurilmagan, OneID login ham ishlamaydi)",
};

describe("N-19 Stage 1: notification baseline invariant", () => {
  const { grants, titles } = loadAll();
  const anyGrantRoles = new Set(grants.map((g) => g.title));

  test("bugungi hisoblangan nishon ro'yxati kutilgan ro'yxatga TENG (drift bo'lsa — shu test eslatadi)", () => {
    expect(computeMissingRoles()).toEqual(EXPECTED_BASELINE_TARGETS);
  });

  test("NOTIFICATION_ACTIONS kanonik to'plamga teng (D-082 bilan BIR XIL manba — konstanta qayta ishlatilgan, dublikat emas)", () => {
    expect([...NOTIFICATION_ACTIONS].sort()).toEqual(
      ["read", "readAll", "update", "delete"].sort(),
    );
  });

  test("`tashqi_tadqiqotchi` — hujjatlangan sabab bilan chiqarib tashlangan (0 grant, placeholder rol)", () => {
    expect(anyGrantRoles.has("tashqi_tadqiqotchi")).toBe(false);
    expect(titles.has("tashqi_tadqiqotchi")).toBe(true);
    expect(INTENTIONALLY_EXCLUDED_ZERO_GRANT.tashqi_tadqiqotchi).toBeTruthy();
  });

  test("`admin` inventarda umuman yo'q (`no-admin-role.test.js` bilan BIR XIL invariant)", () => {
    expect(titles.has("admin")).toBe(false);
    expect(anyGrantRoles.has("admin")).toBe(false);
  });

  test.each(EXPECTED_BASELINE_TARGETS)(
    '"%s" — inventarda kamida 1 boshqa modul granti BOR, lekin notification YO\'Q (aynan shu bo\'shliqni notification-baseline.seed.js yopadi)',
    (title) => {
      expect(anyGrantRoles.has(title)).toBe(true);
      const hasNotif = grants.some(
        (g) => g.title === title && g.section === MODULES.NOTIFICATION,
      );
      expect(hasNotif).toBe(false);
    },
  );
});
