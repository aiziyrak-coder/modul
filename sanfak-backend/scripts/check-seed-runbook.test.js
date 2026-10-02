const fs = require("fs");
const path = require("path");

const {
  check,
  hasFailures,
  isRbac,
  needsDevGuard,
  hasDevGuard,
  GUARD_EXEMPT,
  USER_SEED_PATTERNS,
} = require("./check-seed-runbook");
const { STEPS } = require("../seed/_deploy-plan");

const KNOWN_PRE_EXISTING_GAPS = new Set([]);

describe("scripts/check-seed-runbook — RBAC seed ↔ runbook kesishmasi", () => {
  test("council-roles.seed.js ENDI ro'yxatga olingan (D-051/D-083 topshirig'i tuzatdi)", () => {
    const { missingNoScript, missingNotDocumented } = check();
    const allMissing = [...missingNoScript, ...missingNotDocumented];
    expect(allMissing).not.toContain("council-roles.seed.js");
  });

  test("BASELINE'dan tashqari YANGI bo'shliq yo'q (regressiya qopqoni)", () => {
    const { missingNoScript, missingNotDocumented } = check();
    const allMissing = [...missingNoScript, ...missingNotDocumented];
    const newGaps = allMissing.filter((f) => !KNOWN_PRE_EXISTING_GAPS.has(f));
    expect(newGaps).toEqual([]);
  });

  test("BASELINE eskirmagan — ro'yxatdagi har bir element hali ham haqiqatan yetishmayapti", () => {
    const { missingNoScript, missingNotDocumented } = check();
    const stillMissing = new Set([...missingNoScript, ...missingNotDocumented]);
    const stale = [...KNOWN_PRE_EXISTING_GAPS].filter((f) => !stillMissing.has(f));
    expect(stale).toEqual([]);
  });
});

describe("scripts/check-seed-runbook — yarn setup:seed rejasi (seed/_deploy-plan.js)", () => {
  test("har bir RBAC seedi rejada, rejada test/demo seed yo'q", () => {
    const { notInPlan, unsafeInPlan } = check();
    expect(notInPlan).toEqual([]);
    expect(unsafeInPlan).toEqual([]);
  });

  test("rejadagi har bir RBAC seedi haqiqatan RBAC oilasidan (reja ↔ naqsh mos)", () => {
    const rbacInPlan = STEPS.map((s) => path.basename(s.file)).filter(isRbac);
    const rbacOnDisk = fs.readdirSync(path.join(__dirname, "..", "seed")).filter(isRbac);
    expect(rbacInPlan.sort()).toEqual(rbacOnDisk.sort());
  });

  test("umumiy natija — muvaffaqiyatli (CLI exit 0)", () => {
    expect(hasFailures(check())).toBe(false);
  });
});

describe("scripts/check-seed-runbook — test-foydalanuvchi seedlarida muhit qo'riqchisi", () => {
  test("hech bir test-foydalanuvchi seedi DEV_ENVS qo'riqchisisiz qolmagan", () => {
    expect(check().missingDevGuard).toEqual([]);
  });

  test("ma'lum 10 seed naqshga tushadi VA qo'riqchisi bor", () => {
    const GUARDED = [
      "council-users.seed.js",
      "malaka-users.seed.js",
      "practice-users.seed.js",
      "residency-test-users.seed.js",
      "scientific-users.seed.js",
      "studyload-users.seed.js",
      "task-users.seed.js",
      "teacher-chain-users.seed.js",
      "teacher-users.seed.js",
      "testUsers.seed.js",
    ];
    for (const f of GUARDED) {
      expect([f, needsDevGuard(f)]).toEqual([f, true]);
      expect([f, hasDevGuard(f)]).toEqual([f, true]);
    }
  });

  test("RBAC/reference seedlari bu tekshiruvga KIRMAYDI (yolg'on signal bo'lmasin)", () => {
    expect(needsDevGuard("references.seed.js")).toBe(false);
    expect(needsDevGuard("permissions.seed.js")).toBe(false);
    expect(needsDevGuard("super-admin.seed.js")).toBe(false);
    expect(needsDevGuard("oqituvchi-test-rbac.seed.js")).toBe(false);
  });

  test("istisno ro'yxati eskirmagan — har element mavjud va naqshga tushadi", () => {
    for (const [file, reason] of GUARD_EXEMPT) {
      expect([file, fs.existsSync(path.join(__dirname, "..", "seed", file))]).toEqual([file, true]);
      expect([file, USER_SEED_PATTERNS.some((re) => re.test(file))]).toEqual([file, true]);
      expect(typeof reason).toBe("string");
    }
  });
});
