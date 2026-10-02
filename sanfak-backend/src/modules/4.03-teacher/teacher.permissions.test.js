const {
  ROLE_PERMISSIONS,
  ROUTE_REQUIREMENTS,
} = require("./teacher.permissions");
const { ROLES, MODULES, ACTIONS } = require("#config/constants");

const actionsOf = (roleTitle, section) =>
  ROLE_PERMISSIONS[roleTitle]?.sections?.[section] || [];

describe("teacher.permissions — struktura", () => {
  test("barcha section qiymatlari MODULES ichida bor", () => {
    const valid = new Set(Object.values(MODULES));
    for (const [roleTitle, def] of Object.entries(ROLE_PERMISSIONS)) {
      for (const section of Object.keys(def.sections || {})) {
        expect({ roleTitle, section, valid: valid.has(section) }).toEqual({
          roleTitle,
          section,
          valid: true,
        });
      }
    }
  });

  test("barcha actionKeys ACTIONS ichida bor", () => {
    const valid = new Set(Object.values(ACTIONS));
    for (const [roleTitle, def] of Object.entries(ROLE_PERMISSIONS)) {
      for (const [section, acts] of Object.entries(def.sections || {})) {
        for (const a of acts) {
          expect({ roleTitle, section, a, valid: valid.has(a) }).toEqual({
            roleTitle,
            section,
            a,
            valid: true,
          });
        }
      }
    }
  });

  test("TZ 4.3 da ishtirok etuvchi 13 ta rol mavjud (A2-BE-2: +5, A2-BE-3a: +1, A2-BE-3b: +1, L-02: +2)", () => {
    expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual(
      [
        ROLES.OQITUVCHI,
        ROLES.KADRLAR,
        ROLES.KAFEDRA_MUDIRI,
        ROLES.DEKAN,
        ROLES.KAFEDRA_USLUBIY_MASUL,
        ROLES.KAFEDRA_ILMIY_MASUL,
        ROLES.KAFEDRA_USTOZ_SHOGIRD_MASUL,
        ROLES.OQUV_USLUBIY_BOSHQARMA,
        ROLES.ICHKI_NAZORAT,
        ROLES.ILMIY_BOLIM,
        ROLES.PROREKTOR,
        ROLES.REKTOR,
        ROLES.FAKULTET_KENGASH_KOTIBI,
      ].sort(),
    );
  });

  test("scopeLevel qiymatlari to'g'ri", () => {
    expect(ROLE_PERMISSIONS[ROLES.OQITUVCHI].scopeLevel).toBe("self");
    expect(ROLE_PERMISSIONS[ROLES.KADRLAR].scopeLevel).toBe("global");
    expect(ROLE_PERMISSIONS[ROLES.KAFEDRA_MUDIRI].scopeLevel).toBe("department");
    expect(ROLE_PERMISSIONS[ROLES.DEKAN].scopeLevel).toBe("faculty");
    expect(ROLE_PERMISSIONS[ROLES.KAFEDRA_USLUBIY_MASUL].scopeLevel).toBe("department");
    expect(ROLE_PERMISSIONS[ROLES.KAFEDRA_ILMIY_MASUL].scopeLevel).toBe("department");
    expect(ROLE_PERMISSIONS[ROLES.KAFEDRA_USTOZ_SHOGIRD_MASUL].scopeLevel).toBe("department");
    expect(ROLE_PERMISSIONS[ROLES.OQUV_USLUBIY_BOSHQARMA].scopeLevel).toBe("global");
    expect(ROLE_PERMISSIONS[ROLES.ICHKI_NAZORAT].scopeLevel).toBe("global");
    expect(ROLE_PERMISSIONS[ROLES.ILMIY_BOLIM].scopeLevel).toBe("global");
    expect(ROLE_PERMISSIONS[ROLES.FAKULTET_KENGASH_KOTIBI].scopeLevel).toBe("faculty");
  });

  test("fakultet_kengash_kotibi — `academicYear:readAll` bor (P-31), yozuv grantlari YO'Q", () => {
    const ay = ROLE_PERMISSIONS[ROLES.FAKULTET_KENGASH_KOTIBI].sections[MODULES.ACADEMIC_YEAR];
    expect(ay).toEqual([ACTIONS.READ_ALL]);
  });
});

describe("🔴 REGRESSION-GUARD — oqituvchi o'z bajargan ishini o'zi tekshira olmaydi", () => {
  test("verify route'da `oqituvchi` roli YO'Q (permit() darajasida ham)", () => {
    const verifyRoute = ROUTE_REQUIREMENTS.find(
      (r) => r.path === "/personal-work-plans/:id/activity/:activityId/verify",
    );
    expect(verifyRoute).toBeDefined();
    expect(verifyRoute.roles).not.toContain(ROLES.OQITUVCHI);
    expect(verifyRoute.roles.sort()).toEqual(
      [ROLES.KAFEDRA_MUDIRI, ROLES.ILMIY_BOLIM].sort(),
    );
  });

  test("ilmiy_bolim `personalWorkPlan` bo'limida READ/READ_ALL/APPROVE/REJECT/REVIEW ga ega", () => {
    expect(actionsOf(ROLES.ILMIY_BOLIM, MODULES.PERSONAL_WORK_PLAN).sort()).toEqual(
      [
        ACTIONS.READ,
        ACTIONS.READ_ALL,
        ACTIONS.APPROVE,
        ACTIONS.REJECT,
        ACTIONS.REVIEW,
      ].sort(),
    );
  });

  test("`personalWorkPlan:review` ni FAQAT kafedra_mudiri va ilmiy_bolim ushlaydi", () => {
    const holders = Object.keys(ROLE_PERMISSIONS).filter((role) =>
      actionsOf(role, MODULES.PERSONAL_WORK_PLAN).includes(ACTIONS.REVIEW),
    );
    expect(holders.sort()).toEqual(
      [ROLES.KAFEDRA_MUDIRI, ROLES.ILMIY_BOLIM].sort(),
    );
  });

  test.each([
    ROLES.DEKAN,
    ROLES.OQUV_USLUBIY_BOSHQARMA,
    ROLES.ICHKI_NAZORAT,
    ROLES.OQITUVCHI,
  ])("%s da `personalWorkPlan:review` YO'Q", (role) => {
    expect(actionsOf(role, MODULES.PERSONAL_WORK_PLAN)).not.toContain(
      ACTIONS.REVIEW,
    );
  });
});

describe("ROUTE_REQUIREMENTS ↔ ROLE_PERMISSIONS mosligi", () => {
  test.each(ROUTE_REQUIREMENTS.map((r) => [`${r.method} ${r.path}`, r]))(
    "%s — ruxsat berilgan rollarda kerakli amal bor",
    (_label, req) => {
      for (const role of req.roles) {
        const acts = actionsOf(role, req.section);
        const ok = req.actions.some((a) => acts.includes(a));
        expect({ role, path: req.path, ok }).toEqual({
          role,
          path: req.path,
          ok: true,
        });
      }
    },
  );
});

describe("🔴 REGRESSION-GUARD — o'qituvchi FAQAT 1-bosqichni (o'zi) tasdiqlay oladi, hech qachon rad eta olmaydi", () => {
  const oqituvchiPlan = () =>
    actionsOf(ROLES.OQITUVCHI, MODULES.PERSONAL_WORK_PLAN);

  test("o'qituvchida `personalWorkPlan:approve` BOR (1-bosqichni o'zi tasdiqlaydi)", () => {
    expect(oqituvchiPlan()).toContain(ACTIONS.APPROVE);
  });

  test("o'qituvchida `personalWorkPlan:reject` HECH QACHON YO'Q", () => {
    expect(oqituvchiPlan()).not.toContain(ACTIONS.REJECT);
  });

  test("o'qituvchida `update` BOR (o'z rejasini yuritish uchun kerak)", () => {
    expect(oqituvchiPlan()).toContain(ACTIONS.UPDATE);
  });

  test("ish rejani 8 bosqich roli + ilmiy_bolim + fakultet_kengash_kotibi (element/hisobot darajasi) tasdiqlaydi — hech kim boshqa aralashmasin", () => {
    const approvers = Object.entries(ROLE_PERMISSIONS)
      .filter(([, d]) =>
        (d.sections?.[MODULES.PERSONAL_WORK_PLAN] || []).includes(
          ACTIONS.APPROVE,
        ),
      )
      .map(([role]) => role)
      .sort();

    expect(approvers).toEqual(
      [
        ROLES.OQITUVCHI,
        ROLES.KAFEDRA_USLUBIY_MASUL,
        ROLES.KAFEDRA_ILMIY_MASUL,
        ROLES.KAFEDRA_USTOZ_SHOGIRD_MASUL,
        ROLES.KAFEDRA_MUDIRI,
        ROLES.OQUV_USLUBIY_BOSHQARMA,
        ROLES.DEKAN,
        ROLES.ICHKI_NAZORAT,
        ROLES.ILMIY_BOLIM,
        ROLES.FAKULTET_KENGASH_KOTIBI,
      ].sort(),
    );
  });

  test("reja rad etuvchilar ro'yxatida `oqituvchi` HECH QACHON yo'q", () => {
    const rejecters = Object.entries(ROLE_PERMISSIONS)
      .filter(([, d]) =>
        (d.sections?.[MODULES.PERSONAL_WORK_PLAN] || []).includes(
          ACTIONS.REJECT,
        ),
      )
      .map(([role]) => role);

    expect(rejecters).not.toContain(ROLES.OQITUVCHI);
    expect(rejecters.sort()).toEqual(
      [
        ROLES.KAFEDRA_USLUBIY_MASUL,
        ROLES.KAFEDRA_ILMIY_MASUL,
        ROLES.KAFEDRA_USTOZ_SHOGIRD_MASUL,
        ROLES.ILMIY_BOLIM,
        ROLES.KAFEDRA_MUDIRI,
        ROLES.OQUV_USLUBIY_BOSHQARMA,
        ROLES.DEKAN,
        ROLES.ICHKI_NAZORAT,
        ROLES.FAKULTET_KENGASH_KOTIBI,
      ].sort(),
    );
  });
});

describe("🔴 REGRESSION-GUARD — kadrlar profilni TAHRIRLAY olmasin", () => {
  const kadrlar = () => actionsOf(ROLES.KADRLAR, MODULES.TEACHER);

  test("kadrlarda `teacher:update` YO'Q", () => {
    expect(kadrlar()).not.toContain(ACTIONS.UPDATE);
  });

  test("kadrlarda `teacher:create` va `teacher:delete` YO'Q", () => {
    expect(kadrlar()).not.toContain(ACTIONS.CREATE);
    expect(kadrlar()).not.toContain(ACTIONS.DELETE);
  });

  test("kadrlarda tasdiqlash/rad etish BOR (TZ 4.3.2)", () => {
    expect(kadrlar()).toContain(ACTIONS.APPROVE);
    expect(kadrlar()).toContain(ACTIONS.REJECT);
  });

  test("profilni FAQAT kadrlar tasdiqlaydi", () => {
    const approvers = Object.entries(ROLE_PERMISSIONS)
      .filter(([, d]) =>
        (d.sections?.[MODULES.TEACHER] || []).includes(ACTIONS.APPROVE),
      )
      .map(([role]) => role);

    expect(approvers).toEqual([ROLES.KADRLAR]);
  });
});

describe("Maxfiylik — kuzatuvchi rollar profilni tahrirlay olmasin (TZ 4.3.10)", () => {
  test.each([ROLES.KAFEDRA_MUDIRI, ROLES.DEKAN])(
    "%s — `teacher` bo'limida faqat o'qish",
    (role) => {
      const acts = actionsOf(role, MODULES.TEACHER);
      expect(acts).toEqual([ACTIONS.READ, ACTIONS.READ_ALL]);
    },
  );

  test("hech bir rolda `teacher:delete` yo'q", () => {
    for (const [role, def] of Object.entries(ROLE_PERMISSIONS)) {
      expect({
        role,
        hasDelete: (def.sections?.[MODULES.TEACHER] || []).includes(
          ACTIONS.DELETE,
        ),
      }).toEqual({ role, hasDelete: false });
    }
  });
});

describe("Route fayllari matritsaga mos (kod ↔ hujjat)", () => {
  const fs = require("fs");
  const read = (p) => fs.readFileSync(require.resolve(p), "utf8");

  test("teacher.routes: approve/reject `permitUpdate` ga qaytmasin", () => {
    const src = read("./teacher/teacher.routes");
    expect(src).toMatch(/\/:id\/approve"\)\.patch\(permitApprove/);
    expect(src).toMatch(/\/:id\/reject"\)\.patch\(permitReject/);
  });

  test("personalWorkPlan.routes: approve/reject `permitUpdate` ga qaytmasin", () => {
    const src = read("./personalWorkPlan/personalWorkPlan.routes");
    expect(src).toMatch(/\/:id\/approve"\)\.patch\(permitApprove/);
    expect(src).toMatch(/\/:id\/reject"\)\.patch\(permitReject/);
  });

  test("personalWorkPlan.routes: /complete YANGI, faqat permitApprove bilan (A2-BE-2)", () => {
    const src = read("./personalWorkPlan/personalWorkPlan.routes");
    expect(src).toMatch(/\/:id\/complete"\)\.patch\(permitApprove/);
  });
});
