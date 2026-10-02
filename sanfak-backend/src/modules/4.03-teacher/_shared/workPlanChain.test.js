const { ROLES } = require("#config/constants");
const {
  GROUPS,
  ROLE_STEP,
  VISIBILITY_BYPASS,
  FAIL_CLOSED,
  stepGroupIndex,
  priorStepsForGroup,
  isGroupComplete,
  nextGroupFor,
  canApprove,
  buildGroupedVisibilityFilter,
  andFilters,
} = require("./workPlanChain");

const STEP_KEYS = [
  "teacher",
  "kafedraUslubiy",
  "kafedraIlmiy",
  "kafedraUstozShogird",
  "kafedraMudiri",
  "oquvUslubiy",
  "dekan",
  "ichkiNazorat",
];

const buildApprovals = (overrides = {}) =>
  STEP_KEYS.map((step) => ({ step, status: overrides[step] || "pending" }));

describe("GROUPS — guruh ta'rifi (ADR-023 Qaror #6)", () => {
  test("6 guruh, TARTIBDA: G0 teacher, G1 kafedra bloki (3 parallel), G2..G5 yakka", () => {
    expect(GROUPS).toHaveLength(6);
    expect(GROUPS[0].steps).toEqual(["teacher"]);
    expect(GROUPS[1].steps).toEqual([
      "kafedraUslubiy",
      "kafedraIlmiy",
      "kafedraUstozShogird",
    ]);
    expect(GROUPS[2].steps).toEqual(["kafedraMudiri"]);
    expect(GROUPS[3].steps).toEqual(["oquvUslubiy"]);
    expect(GROUPS[4].steps).toEqual(["dekan"]);
    expect(GROUPS[5].steps).toEqual(["ichkiNazorat"]);
  });

  test("barcha 8 bosqich GURUHLARDA aynan bir marta bor (yo'qolgan/dublikat yo'q)", () => {
    const flattened = GROUPS.flatMap((g) => g.steps);
    expect(flattened.sort()).toEqual([...STEP_KEYS].sort());
  });
});

describe("ROLE_STEP — rol -> bosqich xaritasi", () => {
  test("8 ta chain rol bor, hammasi GROUPS ichidagi step'larga mos", () => {
    expect(Object.keys(ROLE_STEP)).toHaveLength(8);
    Object.values(ROLE_STEP).forEach((step) => {
      expect(stepGroupIndex(step)).toBeGreaterThanOrEqual(0);
    });
  });

  test("`oqituvchi` -> `teacher` (G0)", () => {
    expect(ROLE_STEP[ROLES.OQITUVCHI]).toBe("teacher");
  });
});

describe("stepGroupIndex / priorStepsForGroup", () => {
  test("`teacher` -> 0-guruh, oldingi step yo'q", () => {
    expect(stepGroupIndex("teacher")).toBe(0);
    expect(priorStepsForGroup(0)).toEqual([]);
  });

  test("`kafedraIlmiy` -> 1-guruh (G1), oldingi faqat `teacher`", () => {
    expect(stepGroupIndex("kafedraIlmiy")).toBe(1);
    expect(priorStepsForGroup(1)).toEqual(["teacher"]);
  });

  test("`kafedraMudiri` -> 2-guruh (G2), oldingi G0+G1 (4 ta step)", () => {
    expect(stepGroupIndex("kafedraMudiri")).toBe(2);
    expect(priorStepsForGroup(2)).toEqual([
      "teacher",
      "kafedraUslubiy",
      "kafedraIlmiy",
      "kafedraUstozShogird",
    ]);
  });

  test("`ichkiNazorat` -> 5-guruh (G5), oldingi 7 ta step (G0..G4)", () => {
    expect(stepGroupIndex("ichkiNazorat")).toBe(5);
    expect(priorStepsForGroup(5)).toEqual([
      "teacher",
      "kafedraUslubiy",
      "kafedraIlmiy",
      "kafedraUstozShogird",
      "kafedraMudiri",
      "oquvUslubiy",
      "dekan",
    ]);
  });

  test("noma'lum step -> -1", () => {
    expect(stepGroupIndex("hackerStep")).toBe(-1);
  });
});

describe("isGroupComplete", () => {
  test("G1 — uchtasi ham approved bo'lsagina true", () => {
    const partial = { approvals: buildApprovals({ kafedraUslubiy: "approved", kafedraIlmiy: "approved" }) };
    expect(isGroupComplete(partial, 1)).toBe(false);

    const full = {
      approvals: buildApprovals({
        kafedraUslubiy: "approved",
        kafedraIlmiy: "approved",
        kafedraUstozShogird: "approved",
      }),
    };
    expect(isGroupComplete(full, 1)).toBe(true);
  });

  test("bitta a'zosi `rejected` bo'lsa ham to'liq EMAS (faqat `approved` hisoblanadi)", () => {
    const plan = {
      approvals: buildApprovals({
        kafedraUslubiy: "approved",
        kafedraIlmiy: "rejected",
        kafedraUstozShogird: "approved",
      }),
    };
    expect(isGroupComplete(plan, 1)).toBe(false);
  });
});

describe("nextGroupFor", () => {
  test("yangi reja (hammasi pending) — G0 navbatda", () => {
    const plan = { approvals: buildApprovals() };
    expect(nextGroupFor(plan).key).toBe("G0");
  });

  test("G0 tugagan — G1 navbatda", () => {
    const plan = { approvals: buildApprovals({ teacher: "approved" }) };
    expect(nextGroupFor(plan).key).toBe("G1");
  });

  test("hammasi approved — `null`", () => {
    const all = {};
    STEP_KEYS.forEach((s) => (all[s] = "approved"));
    const plan = { approvals: buildApprovals(all) };
    expect(nextGroupFor(plan)).toBeNull();
  });
});

describe("canApprove — guruh navbati (ADR-023 Qaror #6 asosiy qoidasi)", () => {
  test("G0 (teacher) — har doim true (oldingi guruh yo'q)", () => {
    const plan = { approvals: buildApprovals() };
    expect(canApprove(plan, "teacher")).toBe(true);
  });

  test("G1 a'zosi — G0 tugagach true, boshqa G1 a'zolarini KUTMAYDI", () => {
    const plan = { approvals: buildApprovals({ teacher: "approved" }) };
    expect(canApprove(plan, "kafedraIlmiy")).toBe(true);
    expect(canApprove(plan, "kafedraUstozShogird")).toBe(true);
  });

  test("G1 tugamasa G2 false", () => {
    const plan = {
      approvals: buildApprovals({ teacher: "approved", kafedraUslubiy: "approved" }),
    };
    expect(canApprove(plan, "kafedraMudiri")).toBe(false);
  });

  test("G1 TO'LIQ tugagach G2 true", () => {
    const plan = {
      approvals: buildApprovals({
        teacher: "approved",
        kafedraUslubiy: "approved",
        kafedraIlmiy: "approved",
        kafedraUstozShogird: "approved",
      }),
    };
    expect(canApprove(plan, "kafedraMudiri")).toBe(true);
  });

  test("noma'lum step — false (fail-closed)", () => {
    const plan = { approvals: buildApprovals() };
    expect(canApprove(plan, "hackerStep")).toBe(false);
  });
});

describe("buildGroupedVisibilityFilter — Mongo filtr shakli", () => {
  test("bypass rollar (super_admin, moderator) — `{}`", () => {
    expect(buildGroupedVisibilityFilter(ROLES.SUPER_ADMIN)).toEqual({});
    expect(buildGroupedVisibilityFilter(ROLES.MODERATOR)).toEqual({});
    expect(VISIBILITY_BYPASS).toEqual([ROLES.SUPER_ADMIN, ROLES.MODERATOR]);
  });

  test("G0 (oqituvchi) — `{}` (cheklov yo'q, scope o'zi qiladi)", () => {
    expect(buildGroupedVisibilityFilter(ROLES.OQITUVCHI)).toEqual({});
  });

  test("zanjirda BOSQICHI yo'q rol — FAIL_CLOSED", () => {
    expect(buildGroupedVisibilityFilter(ROLES.KADRLAR)).toEqual(FAIL_CLOSED);
    expect(buildGroupedVisibilityFilter(undefined)).toEqual(FAIL_CLOSED);
    expect(buildGroupedVisibilityFilter("mavjud-bolmagan-rol")).toEqual(FAIL_CLOSED);
  });

  test("G2 (kafedra_mudiri) — `approvals` ustida `$not $elemMatch`, priorSteps G0+G1", () => {
    const filter = buildGroupedVisibilityFilter(ROLES.KAFEDRA_MUDIRI);
    expect(filter).toEqual({
      approvals: {
        $not: {
          $elemMatch: {
            step: { $in: ["teacher", "kafedraUslubiy", "kafedraIlmiy", "kafedraUstozShogird"] },
            status: { $ne: "approved" },
          },
        },
      },
    });
  });

  test("G5 (ichki_nazorat) — priorSteps 7 ta (G0..G4)", () => {
    const filter = buildGroupedVisibilityFilter(ROLES.ICHKI_NAZORAT);
    expect(filter.approvals.$not.$elemMatch.step.$in).toHaveLength(7);
    expect(filter.approvals.$not.$elemMatch.step.$in).not.toContain("ichkiNazorat");
  });

  test("QULFLOVCHI TEST — draft reja (hammasi pending) G1 filtridan O'TMAYDI (mongo semantikasi qo'lda taqlid)", () => {
    const filter = buildGroupedVisibilityFilter(ROLES.KAFEDRA_USLUBIY_MASUL);
    const priorSteps = filter.approvals.$not.$elemMatch.step.$in;
    const draftApprovals = buildApprovals();
    const elemMatchHit = draftApprovals.some(
      (s) => priorSteps.includes(s.step) && s.status !== "approved",
    );
    expect(elemMatchHit).toBe(true);
  });
});

describe("andFilters — xavfsiz kompozitsiya", () => {
  test("bo'sh filtrlar — `{}`", () => {
    expect(andFilters({}, {})).toEqual({});
    expect(andFilters()).toEqual({});
  });

  test("bitta filtr — mazmuni bir xil, lekin YANGI obyekt (mutatsiyadan himoya)", () => {
    const f = { teacher: "x" };
    const result = andFilters(f, {});
    expect(result).toEqual(f);
    expect(result).not.toBe(f);
  });

  test("REGRESSIYA: `FAIL_CLOSED` orqali qaytgan filtrni mutatsiya qilish ORIGINALGA tegmaydi", () => {
    const filter = andFilters(FAIL_CLOSED);
    filter.active = true;

    expect(FAIL_CLOSED).toEqual({ $expr: { $eq: [1, 0] } });
    expect(FAIL_CLOSED.active).toBeUndefined();
  });

  test("to'qnashuvsiz kalitlar — flat merge (spread bilan bir xil natija)", () => {
    expect(andFilters({ teacher: "x" }, { active: true })).toEqual({
      teacher: "x",
      active: true,
    });
  });

  test("to'qnashgan kalit — `$and` (biri ikkinchisini sezilmay o'chirmaydi)", () => {
    const a = { approvals: { $not: { $elemMatch: { step: "x" } } } };
    const b = { approvals: { $elemMatch: { step: "y" } } };
    expect(andFilters(a, b)).toEqual({ $and: [a, b] });
  });
});
