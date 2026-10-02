"use strict";

const { ROLES } = require("#config/constants");
const {
  buildChainVisibilityFilter,
  andFilters,
} = require("./chainVisibility");

const BLOCKED = { $expr: { $eq: [1, 0] } };

describe("workload — HOZIRGI chainVisibilityFilter bilan deepEqual (mutatsiya qulfi)", () => {
  const STEP_ORDER = ["methodical", "kafedra", "financial", "prorektor", "rektor"];
  const STEP_ROLES = {
    methodical: ROLES.OQUV_USLUBIY_BOSHQARMA,
    kafedra: ROLES.KAFEDRA_MUDIRI,
    financial: ROLES.REJA_MOLIYA,
    prorektor: ROLES.PROREKTOR,
    rektor: ROLES.REKTOR,
  };
  function legacyChainVisibilityFilter(userRole) {
    if ([ROLES.SUPER_ADMIN, ROLES.MODERATOR].includes(userRole)) return {};
    const myStep = STEP_ORDER.find((step) => STEP_ROLES[step] === userRole);
    if (!myStep) return { $expr: { $eq: [1, 0] } };
    const priorSteps = STEP_ORDER.slice(0, STEP_ORDER.indexOf(myStep));
    if (priorSteps.length === 0) return {};
    return {
      approvalSteps: {
        $not: {
          $elemMatch: { step: { $in: priorSteps }, status: { $ne: "approved" } },
        },
      },
    };
  }

  const ROLES_TO_CHECK = [
    ROLES.OQUV_USLUBIY_BOSHQARMA,
    ROLES.KAFEDRA_MUDIRI,
    ROLES.REJA_MOLIYA,
    ROLES.PROREKTOR,
    ROLES.REKTOR,
    ROLES.DEKAN,
    ROLES.SUPER_ADMIN,
    ROLES.MODERATOR,
  ];

  test.each(ROLES_TO_CHECK)("rol=%s", (role) => {
    expect(buildChainVisibilityFilter("workload", role)).toEqual(
      legacyChainVisibilityFilter(role),
    );
  });
});

describe("scienceProgram — variant-aware qulf (R-4.02-33)", () => {
  test("v142 uchun arm/methodical/prorektor/rektor shoxi fail-closed", () => {
    const filter = buildChainVisibilityFilter("scienceProgram", ROLES.ARM);
    const v142Branch = filter.$or.find((b) => b.formVersion === "v142");
    expect(v142Branch.$expr).toEqual(BLOCKED.$expr);
  });

  test("v259 uchun dekan shoxi — teacher/kafedra/arm/methodical approved talab qiladi (ADR-035)", () => {
    const filter = buildChainVisibilityFilter("scienceProgram", ROLES.DEKAN);
    const v259Branch = filter.$or.find((b) =>
      Array.isArray(b.formVersion?.$in),
    );
    expect(v259Branch.$expr).toBeUndefined();
    expect(v259Branch.approvalSteps.$not.$elemMatch.step.$in).toEqual([
      "teacher",
      "kafedra",
      "arm",
      "methodical",
    ]);
  });

  test("rektor/prorektor — scienceProgram'da kuzatuvchi: draft/rejected'dan boshqa hammasini ko'radi (ADR-035 S1)", () => {
    for (const role of [ROLES.REKTOR, ROLES.PROREKTOR]) {
      expect(buildChainVisibilityFilter("scienceProgram", role)).toEqual({
        status: { $nin: ["draft", "rejected"] },
      });
    }
  });

  test("kafedra (KAFEDRA_MUDIRI) v142 da faqat teacher approved talab qiladi", () => {
    const filter = buildChainVisibilityFilter(
      "scienceProgram",
      ROLES.KAFEDRA_MUDIRI,
    );
    const v142Branch = filter.$or.find((b) => b.formVersion === "v142");
    expect(v142Branch.approvalSteps.$not.$elemMatch.step.$in).toEqual([
      "teacher",
    ]);
  });
});

describe("kuzatuvchi (observerRoles) — zanjir kaliti YO'Q, faqat status filtri", () => {
  test("workloadDistribution: kadrlar — draft/new/rejected ko'rmaydi", () => {
    const filter = buildChainVisibilityFilter(
      "workloadDistribution",
      ROLES.KADRLAR,
    );
    expect(filter).toEqual({
      status: { $nin: ["draft", "new", "rejected"] },
    });
    expect(filter.approvalSteps).toBeUndefined();
  });

  test("syllabus: rektor — draft/new/rejected ko'rmaydi", () => {
    const filter = buildChainVisibilityFilter("syllabus", ROLES.REKTOR);
    expect(filter).toEqual({ status: { $nin: ["draft", "new", "rejected"] } });
  });

  test("workingSchedule: kafedra_mudiri — draft/rejected ko'rmaydi ('new' yo'q)", () => {
    const filter = buildChainVisibilityFilter(
      "workingSchedule",
      ROLES.KAFEDRA_MUDIRI,
    );
    expect(filter).toEqual({ status: { $nin: ["draft", "rejected"] } });
  });
});

describe("ownerRoles — syllabus.oqituvchi (P0-1)", () => {
  test("userId berilmasa — FAIL_CLOSED (xavfsiz default, xato chaqiruvni yashirmaydi)", () => {
    const filter = buildChainVisibilityFilter("syllabus", ROLES.OQITUVCHI);
    expect(filter).toEqual(BLOCKED);
  });

  test("userId berilsa — faqat egaga tegishli filtr, FAIL_CLOSED emas", () => {
    const filter = buildChainVisibilityFilter("syllabus", ROLES.OQITUVCHI, {
      userId: "507f1f77bcf86cd799439011",
    });
    expect(filter).toEqual({ "author.teacher": "507f1f77bcf86cd799439011" });
  });

  test("scienceProgram.oqituvchi — ownerRoles YO'Q (allaqachon 1-bosqich `teacher`), userId ta'sir qilmaydi", () => {
    const withoutUserId = buildChainVisibilityFilter("scienceProgram", ROLES.OQITUVCHI);
    const withUserId = buildChainVisibilityFilter("scienceProgram", ROLES.OQITUVCHI, {
      userId: "507f1f77bcf86cd799439011",
    });
    expect(withoutUserId).toEqual(withUserId);
  });
});

describe("contingentReport — submitterRoles (kotib) va boshqa rollar", () => {
  test("fakultet_kengash_kotibi (submitter) — BARCHA holatlarni ko'radi ({}), fail-closed emas", () => {
    expect(
      buildChainVisibilityFilter("contingentReport", ROLES.FAKULTET_KENGASH_KOTIBI, { userId: "u" }),
    ).toEqual({});
  });

  test("dekan — 1-bosqich egasi, oldingi bosqich yo'q ⇒ {} (draft/rejected ham ko'rinadi)", () => {
    expect(buildChainVisibilityFilter("contingentReport", ROLES.DEKAN)).toEqual({});
  });

  test.each([ROLES.OQUV_USLUBIY_BOSHQARMA, ROLES.REKTOR, ROLES.PROREKTOR])(
    "%s — kuzatuvchi: draft/rejected KO'RMAYDI, in_review/approved ko'radi",
    (role) => {
      expect(buildChainVisibilityFilter("contingentReport", role)).toEqual({
        status: { $nin: ["draft", "rejected"] },
      });
    },
  );

  test.each([ROLES.KAFEDRA_MUDIRI, ROLES.OQITUVCHI, ROLES.REJA_MOLIYA, ROLES.KADRLAR, "begona_rol"])(
    "%s — zanjirda yo'q ⇒ FAIL_CLOSED",
    (role) => {
      expect(buildChainVisibilityFilter("contingentReport", role)).toEqual(BLOCKED);
    },
  );

  test("super_admin/moderator — bypass ({})", () => {
    expect(buildChainVisibilityFilter("contingentReport", ROLES.SUPER_ADMIN)).toEqual({});
    expect(buildChainVisibilityFilter("contingentReport", ROLES.MODERATOR)).toEqual({});
  });

  test("submitterRoles bo'lmagan entity'da kotib avvalgidek FAIL_CLOSED (xulq o'zgarmagan)", () => {
    expect(buildChainVisibilityFilter("workload", ROLES.FAKULTET_KENGASH_KOTIBI)).toEqual(BLOCKED);
    expect(buildChainVisibilityFilter("workloadSummary", ROLES.FAKULTET_KENGASH_KOTIBI)).toEqual(BLOCKED);
  });

  test("scope bilan birga — kotib faqat o'z fakulteti (andFilters)", () => {
    const filter = andFilters(
      { faculty: "f1" },
      buildChainVisibilityFilter("contingentReport", ROLES.FAKULTET_KENGASH_KOTIBI),
    );
    expect(filter).toEqual({ faculty: "f1" });
  });
});

describe("defaultVariant — scienceProgram v259 (P1-4, formVersion backfill qilinmagan)", () => {
  test("v259 shoxi selektori `$in: [\"v259\", null]` — maydon yo'q/null hujjatni ham qamraydi", () => {
    const filter = buildChainVisibilityFilter("scienceProgram", ROLES.KAFEDRA_MUDIRI);
    const v259Branch = filter.$or.find((b) => Array.isArray(b.formVersion?.$in));
    expect(v259Branch.formVersion).toEqual({ $in: ["v259", null] });
  });

  test("v142 shoxi selektori aniq tenglik — backfill qoidasi tegishli EMAS", () => {
    const filter = buildChainVisibilityFilter("scienceProgram", ROLES.KAFEDRA_MUDIRI);
    const v142Branch = filter.$or.find((b) => b.formVersion === "v142");
    expect(v142Branch).toBeDefined();
  });
});

describe("noma'lum entity — throw", () => {
  test("registrda yo'q kalit bilan chaqirilsa xato beradi", () => {
    expect(() =>
      buildChainVisibilityFilter("noSuchEntity", ROLES.SUPER_ADMIN),
    ).toThrow();
  });
});

describe("andFilters", () => {
  test("bo'sh {} tashlanadi", () => {
    expect(andFilters({}, { status: "in_review" })).toEqual({
      status: "in_review",
    });
  });

  test("hech qanday filtr bo'lmasa {} qaytadi", () => {
    expect(andFilters({}, {})).toEqual({});
    expect(andFilters()).toEqual({});
  });

  test("to'qnashmaydigan kalitlar — oddiy merge", () => {
    expect(andFilters({ department: "d1" }, { $expr: { $eq: [1, 0] } })).toEqual(
      { department: "d1", $expr: { $eq: [1, 0] } },
    );
  });

  test("ikki approvalSteps kalitli filtr — ikkalasi ham saqlanadi ($and)", () => {
    const a = { approvalSteps: { $elemMatch: { step: "x" } } };
    const b = { approvalSteps: { $not: { $elemMatch: { step: "y" } } } };
    expect(andFilters(a, b)).toEqual({ $and: [a, b] });
  });
});

describe("andFilters — qaytarilgan obyekt chaqiruvchidan izolyatsiya qilingan", () => {
  test("bitta filtr: natijaga yozish MANBANI o'zgartirmaydi", () => {
    const source = { $expr: { $eq: [1, 0] } };
    const result = andFilters(source, {});
    result.active = true;
    expect(source).not.toHaveProperty("active");
    expect(result).toHaveProperty("active", true);
  });

  test("fail-closed filtr ketma-ket chaqiruvlarda toza qoladi", () => {
    const first = buildChainVisibilityFilter("workload", "begona_rol");
    first.active = true;
    const second = buildChainVisibilityFilter("workload", "begona_rol");
    expect(second).not.toHaveProperty("active");
    expect(second).toEqual({ $expr: { $eq: [1, 0] } });
  });
});
