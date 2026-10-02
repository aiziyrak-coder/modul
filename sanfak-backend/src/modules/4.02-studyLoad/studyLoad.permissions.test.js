const { ROLE_PERMISSIONS, ROUTE_REQUIREMENTS } = require("./studyLoad.permissions");
const { MODULES, ACTIONS, ROLES } = require("#config/constants");

const CANONICAL_MODULES = new Set(Object.values(MODULES));
const CANONICAL_ACTIONS = new Set(Object.values(ACTIONS));

const roleCanCall = (roleTitle, section, actions) => {
  const roleDef = ROLE_PERMISSIONS[roleTitle];
  if (!roleDef) return false;
  const actionKeys = roleDef.sections[section] || [];
  return actions.some((action) => actionKeys.includes(action));
};

describe("studyLoad.permissions — ROLE_PERMISSIONS struktura", () => {
  test("barcha section qiymatlari MODULES ichida bor", () => {
    for (const [roleTitle, def] of Object.entries(ROLE_PERMISSIONS)) {
      for (const section of Object.keys(def.sections)) {
        expect(CANONICAL_MODULES.has(section)).toBe(true);
        expect(`${roleTitle}:${section}`).toBeTruthy();
      }
    }
  });

  test("barcha actionKeys ACTIONS ichida bor", () => {
    for (const [roleTitle, def] of Object.entries(ROLE_PERMISSIONS)) {
      for (const [section, actionKeys] of Object.entries(def.sections)) {
        for (const action of actionKeys) {
          expect(CANONICAL_ACTIONS.has(action)).toBe(true);
          expect(`${roleTitle}:${section}:${action}`).toBeTruthy();
        }
      }
    }
  });

  test("11 ta TZ 4.2 bilan bog'liq rol mavjud (8 tasdiqlash-zanjiri roli + kadrlar VIEW-ONLY + magistratura_bolim o'quv reja CRUD + fakultet_kengash_kotibi kontingent)", () => {
    expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual(
      [
        ROLES.OQITUVCHI,
        ROLES.KAFEDRA_MUDIRI,
        ROLES.OQUV_USLUBIY_BOSHQARMA,
        ROLES.REJA_MOLIYA,
        ROLES.DEKAN,
        ROLES.PROREKTOR,
        ROLES.REKTOR,
        ROLES.ARM,
        ROLES.KADRLAR,
        ROLES.MAGISTRATURA_BOLIM,
        ROLES.FAKULTET_KENGASH_KOTIBI,
      ].sort(),
    );
  });
});

describe("REGRESSION-GUARD — ADR-024 Faza 2 (learningProcess ko'rish darajasi)", () => {
  test("prorektorda learningProcess:readAll BOR", () => {
    expect(roleCanCall(ROLES.PROREKTOR, MODULES.LEARNING_PROCESS, [ACTIONS.READ_ALL])).toBe(
      true,
    );
  });

  test("prorektorda learningProcess:approve YO'Q (Faza 4 gacha)", () => {
    expect(roleCanCall(ROLES.PROREKTOR, MODULES.LEARNING_PROCESS, [ACTIONS.APPROVE])).toBe(
      false,
    );
  });

  test("prorektorda studyPlan:export BOR (PDF eksport)", () => {
    expect(roleCanCall(ROLES.PROREKTOR, MODULES.STUDY_PLAN, [ACTIONS.EXPORT])).toBe(true);
  });

  test("magistratura_bolim rolida learningProcess:readAll BOR", () => {
    expect(
      roleCanCall(ROLES.MAGISTRATURA_BOLIM, MODULES.LEARNING_PROCESS, [ACTIONS.READ_ALL]),
    ).toBe(true);
  });

  test("magistratura_bolim rolida learningProcess:approve YO'Q (Faza 4 gacha)", () => {
    expect(
      roleCanCall(ROLES.MAGISTRATURA_BOLIM, MODULES.LEARNING_PROCESS, [ACTIONS.APPROVE]),
    ).toBe(false);
  });

  test("magistratura_bolim rolida studyPlan:export BOR (PDF eksport)", () => {
    expect(roleCanCall(ROLES.MAGISTRATURA_BOLIM, MODULES.STUDY_PLAN, [ACTIONS.EXPORT])).toBe(
      true,
    );
  });

  test("magistratura_bolim scopeLevel — global", () => {
    expect(ROLE_PERMISSIONS[ROLES.MAGISTRATURA_BOLIM].scopeLevel).toBe("global");
  });

  test("learning-process/:id/approve talabida prorektor/magistratura_bolim roles ro'yxatida YO'Q", () => {
    const approveReq = ROUTE_REQUIREMENTS.find(
      (r) => r.path === "/learning-process/:id/approve" && r.method === "PUT",
    );
    expect(approveReq).toBeDefined();
    expect(approveReq.roles).not.toContain(ROLES.PROREKTOR);
    expect(approveReq.roles).not.toContain(ROLES.MAGISTRATURA_BOLIM);
  });
});

describe("ADR-049 — magistratura_bolim o'quv reja CRUD", () => {
  const MAG = ROLES.MAGISTRATURA_BOLIM;
  const sections = ROLE_PERMISSIONS[MAG].sections;
  const sorted = (a) => [...a].sort();

  test("studyPlan — aynan VIEW_ONLY + create/update/delete (8 ta)", () => {
    expect(sorted(sections[MODULES.STUDY_PLAN])).toEqual(
      sorted([
        ACTIONS.READ,
        ACTIONS.READ_ALL,
        ACTIONS.SEARCH,
        ACTIONS.FILTER,
        ACTIONS.EXPORT,
        ACTIONS.CREATE,
        ACTIONS.UPDATE,
        ACTIONS.DELETE,
      ]),
    );
  });

  test("learningProcess — aynan VIEW_ONLY + create/update (7 ta, delete YO'Q)", () => {
    expect(sorted(sections[MODULES.LEARNING_PROCESS])).toEqual(
      sorted([
        ACTIONS.READ,
        ACTIONS.READ_ALL,
        ACTIONS.SEARCH,
        ACTIONS.FILTER,
        ACTIONS.EXPORT,
        ACTIONS.CREATE,
        ACTIONS.UPDATE,
      ]),
    );
  });

  test("oldingi VIEW_ONLY grantlari saqlangan (seed MERGE faqat qo'shadi)", () => {
    const VIEW = [ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.SEARCH, ACTIONS.FILTER, ACTIONS.EXPORT];
    for (const section of [MODULES.STUDY_PLAN, MODULES.LEARNING_PROCESS]) {
      expect(sections[section]).toEqual(expect.arrayContaining(VIEW));
    }
  });

});

describe("ADR-049 — magistratura_bolim: tasdiqlash va ishchi reja yo'q, qamrov O'UB kabi", () => {
  const MAG = ROLES.MAGISTRATURA_BOLIM;
  const sections = ROLE_PERMISSIONS[MAG].sections;

  test.each([
    [MODULES.LEARNING_PROCESS, ACTIONS.APPROVE],
    [MODULES.LEARNING_PROCESS, ACTIONS.REJECT],
    [MODULES.LEARNING_PROCESS, ACTIONS.DELETE],
    [MODULES.STUDY_PLAN, ACTIONS.APPROVE],
    [MODULES.STUDY_PLAN, ACTIONS.REJECT],
    [MODULES.WORKING_SCHEDULE, ACTIONS.CREATE],
    [MODULES.WORKING_SCHEDULE, ACTIONS.UPDATE],
    [MODULES.WORKING_PLAN, ACTIONS.UPDATE],
  ])("%s:%s YO'Q (tasdiqlash — ADR-027, ishchi reja yaratish — O'UB)", (section, action) => {
    expect(roleCanCall(MAG, section, [action])).toBe(false);
  });

  test("ishchi jadval / ishchi reja bo'limlari umuman e'lon qilinmagan", () => {
    expect(sections[MODULES.WORKING_SCHEDULE]).toBeUndefined();
    expect(sections[MODULES.WORKING_PLAN]).toBeUndefined();
  });

  test("scopeLevel global — O'UB bilan bir xil qamrov (egasi tanlovi)", () => {
    expect(ROLE_PERMISSIONS[MAG].scopeLevel).toBe(
      ROLE_PERMISSIONS[ROLES.OQUV_USLUBIY_BOSHQARMA].scopeLevel,
    );
  });

  test("O'UB chaqiradigan har o'quv reja route'ini (tasdiqlashdan tashqari) magistratura_bolim ham chaqira oladi", () => {
    const writes = ROUTE_REQUIREMENTS.filter(
      (r) =>
        [MODULES.STUDY_PLAN, MODULES.LEARNING_PROCESS].includes(r.section) &&
        r.roles.includes(ROLES.OQUV_USLUBIY_BOSHQARMA) &&
        !r.actions.includes(ACTIONS.APPROVE),
    );
    expect(writes.length).toBeGreaterThanOrEqual(12);
    for (const r of writes) {
      expect({ route: `${r.method} ${r.path}`, roles: r.roles }).toEqual(
        expect.objectContaining({ roles: expect.arrayContaining([MAG]) }),
      );
    }
  });
});

describe("Zanjir qamrovi — har bosqichda mas'ul rol bor", () => {
  const SYLLABUS_CHAIN = [
    ["kafedra", ROLES.KAFEDRA_MUDIRI],
    ["arm", ROLES.ARM],
    ["methodical", ROLES.OQUV_USLUBIY_BOSHQARMA],
    ["dean", ROLES.DEKAN],
    ["prorektor", ROLES.PROREKTOR],
  ];

  const SCIENCE_PROGRAM_CHAIN = [
    ["kafedra", ROLES.KAFEDRA_MUDIRI],
    ["arm", ROLES.ARM],
    ["methodical", ROLES.OQUV_USLUBIY_BOSHQARMA],
    ["dean", ROLES.DEKAN],
  ];

  test.each(SYLLABUS_CHAIN)(
    "sillabus zanjiri: `%s` bosqichini %s tasdiqlay/rad eta oladi",
    (step, role) => {
      const actions = ROLE_PERMISSIONS[role].sections[MODULES.SYLLABUS];
      expect(actions).toBeDefined();
      expect(
        actions.includes(ACTIONS.APPROVE) || actions.includes(ACTIONS.UPDATE),
      ).toBe(true);
      expect(actions).toContain(ACTIONS.REJECT);
    },
  );

  test.each(SCIENCE_PROGRAM_CHAIN)(
    "fan dasturi zanjiri: `%s` bosqichini %s tasdiqlay/rad eta oladi",
    (step, role) => {
      const actions = ROLE_PERMISSIONS[role].sections[MODULES.SCIENCE_PROGRAM];
      expect(actions).toBeDefined();
      expect(
        actions.includes(ACTIONS.APPROVE) || actions.includes(ACTIONS.UPDATE),
      ).toBe(true);
      expect(actions).toContain(ACTIONS.REJECT);
    },
  );

  test("o'qituvchi sillabus/fan dasturini submit qila oladi (draft → in_review)", () => {
    for (const section of [MODULES.SYLLABUS, MODULES.SCIENCE_PROGRAM]) {
      const actions = ROLE_PERMISSIONS[ROLES.OQITUVCHI].sections[section];
      expect(actions).toContain(ACTIONS.UPDATE);
    }
  });

  test("dekan sillabus zanjirida BOR (TZ user flow, 4-bosqich)", () => {
    const chainRoles = SYLLABUS_CHAIN.map(([, role]) => role);
    expect(chainRoles).toContain(ROLES.DEKAN);
    expect(SYLLABUS_CHAIN).toHaveLength(5);
    expect(SYLLABUS_CHAIN[3]).toEqual(["dean", ROLES.DEKAN]);
  });

  test("rektor/prorektor fan dasturi zanjirida YO'Q — granti ko'rish darajasida (ADR-035)", () => {
    const chainRoles = SCIENCE_PROGRAM_CHAIN.map(([, role]) => role);
    expect(chainRoles).not.toContain(ROLES.REKTOR);
    expect(chainRoles).not.toContain(ROLES.PROREKTOR);
    expect(chainRoles).toContain(ROLES.DEKAN);
    for (const role of [ROLES.REKTOR, ROLES.PROREKTOR]) {
      const actions = ROLE_PERMISSIONS[role].sections[MODULES.SCIENCE_PROGRAM];
      expect(actions).not.toContain(ACTIONS.APPROVE);
      expect(actions).toContain(ACTIONS.READ_ALL);
      expect(actions).toContain(ACTIONS.EXPORT);
    }
    expect(ROLE_PERMISSIONS[ROLES.REKTOR].sections[MODULES.SCIENCE_PROGRAM]).toContain(
      ACTIONS.REJECT,
    );
    expect(
      ROLE_PERMISSIONS[ROLES.PROREKTOR].sections[MODULES.SCIENCE_PROGRAM],
    ).not.toContain(ACTIONS.REJECT);
  });
});

describe("T-04 — teacherLeave: O'UB boshqariladigan bo'sh, TZ §4.2.9 ishtirokchilari to'g'ri", () => {
  test("O'UB: teacherLeave bo'limi e'lon qilingan (managed) va BO'SH — seed legacy grantni olib tashlaydi", () => {
    const sections = ROLE_PERMISSIONS[ROLES.OQUV_USLUBIY_BOSHQARMA].sections;
    expect(Object.prototype.hasOwnProperty.call(sections, MODULES.TEACHER_LEAVE)).toBe(true);
    expect(sections[MODULES.TEACHER_LEAVE]).toEqual([]);
  });

  test("o'qituvchi yaratadi (create), kafedra mudiri tasdiqlaydi/rad etadi (update), O'UB — hech biri", () => {
    expect(roleCanCall(ROLES.OQITUVCHI, MODULES.TEACHER_LEAVE, [ACTIONS.CREATE])).toBe(true);
    expect(roleCanCall(ROLES.KAFEDRA_MUDIRI, MODULES.TEACHER_LEAVE, [ACTIONS.UPDATE])).toBe(true);
    for (const a of [ACTIONS.CREATE, ACTIONS.UPDATE, ACTIONS.APPROVE, ACTIONS.REJECT, ACTIONS.READ_ALL]) {
      expect(roleCanCall(ROLES.OQUV_USLUBIY_BOSHQARMA, MODULES.TEACHER_LEAVE, [a])).toBe(false);
    }
  });

  test("ROUTE_REQUIREMENTS: teacher-leaves approve/reject faqat kafedra mudiri", () => {
    for (const path of ["/teacher-leaves/:id/approve", "/teacher-leaves/:id/reject"]) {
      const req = ROUTE_REQUIREMENTS.find((r) => r.path === path);
      expect(req).toBeDefined();
      expect(req.roles).toEqual([ROLES.KAFEDRA_MUDIRI]);
    }
  });
});

describe("F-01 — dekan: workload boshqariladigan bo'sh", () => {
  test("dekan: workload bo'limi e'lon qilingan (managed) va BO'SH — seed legacy grantni olib tashlaydi", () => {
    const sections = ROLE_PERMISSIONS[ROLES.DEKAN].sections;
    expect(Object.prototype.hasOwnProperty.call(sections, MODULES.WORKLOAD)).toBe(true);
    expect(sections[MODULES.WORKLOAD]).toEqual([]);
  });

  test("hech bir /workloads route talabida dekan yo'q (grant olib tashlansa zanjir uzilmaydi)", () => {
    const workloadRoutes = ROUTE_REQUIREMENTS.filter((r) => r.section === MODULES.WORKLOAD);
    expect(workloadRoutes.length).toBeGreaterThan(0);
    for (const req of workloadRoutes) {
      expect(req.roles || []).not.toContain(ROLES.DEKAN);
    }
  });
});

describe("Zanjir qamrovi — yuklama / taqsimot / ishchi reja", () => {
  const WORKLOAD_CHAIN = [
    ["methodical", ROLES.OQUV_USLUBIY_BOSHQARMA],
    ["kafedra", ROLES.KAFEDRA_MUDIRI],
    ["financial", ROLES.REJA_MOLIYA],
    ["prorektor", ROLES.PROREKTOR],
    ["rektor", ROLES.REKTOR],
  ];

  const DISTRIBUTION_CHAIN = [
    ["kafedra", ROLES.KAFEDRA_MUDIRI],
    ["methodical", ROLES.OQUV_USLUBIY_BOSHQARMA],
    ["financial", ROLES.REJA_MOLIYA],
    ["dean", ROLES.DEKAN],
    ["prorektor", ROLES.PROREKTOR],
  ];

  const WORKING_SCHEDULE_CHAIN = [
    ["methodical", ROLES.OQUV_USLUBIY_BOSHQARMA],
    ["dean", ROLES.DEKAN],
    ["prorektor", ROLES.PROREKTOR],
    ["rektor", ROLES.REKTOR],
  ];

  const expectStepCovered = (section, role) => {
    const actions = ROLE_PERMISSIONS[role].sections[section];
    expect(actions).toBeDefined();
    expect(
      actions.includes(ACTIONS.APPROVE) || actions.includes(ACTIONS.UPDATE),
    ).toBe(true);
    expect(actions).toContain(ACTIONS.REJECT);
  };

  test.each(WORKLOAD_CHAIN)(
    "yuklama zanjiri: `%s` bosqichini %s tasdiqlay/rad eta oladi",
    (step, role) => expectStepCovered(MODULES.WORKLOAD, role),
  );

  test.each(DISTRIBUTION_CHAIN)(
    "taqsimot zanjiri: `%s` bosqichini %s tasdiqlay/rad eta oladi",
    (step, role) => expectStepCovered(MODULES.WORKLOAD_DISTRIBUTION, role),
  );

  test.each(WORKING_SCHEDULE_CHAIN)(
    "ishchi o'quv reja zanjiri: `%s` bosqichini %s tasdiqlay/rad eta oladi",
    (step, role) => expectStepCovered(MODULES.WORKING_SCHEDULE, role),
  );

  test("taqsimot zanjirida REKTOR YO'Q (zanjir prorektorda tugaydi)", () => {
    expect(DISTRIBUTION_CHAIN.map(([, r]) => r)).not.toContain(ROLES.REKTOR);
  });
});

describe("REGRESSION-GUARD — kafedra_mudiri WORKLOAD grantlari", () => {
  const actions = () =>
    ROLE_PERMISSIONS[ROLES.KAFEDRA_MUDIRI].sections[MODULES.WORKLOAD] || [];

  test("APPROVE BOR (aks holda yuklama zanjiri `kafedra` da uzilib qoladi)", () => {
    expect(actions()).toContain(ACTIONS.APPROVE);
  });

  test("REJECT BOR (/workloads/reject/:id → [REJECT])", () => {
    expect(actions()).toContain(ACTIONS.REJECT);
  });

  test("UPDATE YO'Q (aks holda `PUT /workloads/:id` tahrirlash ham ochiladi)", () => {
    expect(actions()).not.toContain(ACTIONS.UPDATE);
  });

  test("CREATE/DELETE YO'Q (yuklamani O'UB yaratadi va o'chiradi)", () => {
    expect(actions()).not.toContain(ACTIONS.CREATE);
    expect(actions()).not.toContain(ACTIONS.DELETE);
  });

  test("/workloads/approve/:id talabida kafedra_mudiri roles ro'yxatida BOR", () => {
    const req = ROUTE_REQUIREMENTS.find(
      (r) => r.path === "/workloads/approve/:id",
    );
    expect(req).toBeDefined();
    expect(req.roles).toContain(ROLES.KAFEDRA_MUDIRI);
  });
});

describe("Reference qamrovi — forma dropdown'lari 403 bo'lmasin", () => {
  const canList = (role, section) =>
    (ROLE_PERMISSIONS[role]?.sections?.[section] || []).includes(ACTIONS.READ_ALL);

  const NEEDS = [
    [ROLES.OQUV_USLUBIY_BOSHQARMA, MODULES.ACADEMIC_LEVEL, "o'quv reja formasi"],
    [ROLES.OQUV_USLUBIY_BOSHQARMA, MODULES.EDUCATION_FORM, "o'quv reja formasi"],
    [ROLES.OQUV_USLUBIY_BOSHQARMA, MODULES.READING_FORM, "o'quv reja formasi"],
    [ROLES.OQUV_USLUBIY_BOSHQARMA, MODULES.SPECIALIZATION, "o'quv reja formasi"],
    [ROLES.OQUV_USLUBIY_BOSHQARMA, MODULES.STUDY_PERIOD, "o'quv reja formasi"],
    [ROLES.OQUV_USLUBIY_BOSHQARMA, MODULES.DIRECTION, "kontingent formasi"],
    [ROLES.OQUV_USLUBIY_BOSHQARMA, MODULES.COURSE, "kontingent formasi"],
    [ROLES.OQUV_USLUBIY_BOSHQARMA, MODULES.LANGUAGE_OF_INSTRUCTION, "kontingent formasi"],
    [ROLES.OQUV_USLUBIY_BOSHQARMA, MODULES.DEPARTMENT, "yuklama yaratish modali"],
    [ROLES.OQUV_USLUBIY_BOSHQARMA, MODULES.ACADEMIC_YEAR, "yuklama yaratish modali"],
    [ROLES.OQUV_USLUBIY_BOSHQARMA, MODULES.GROUP, "kontingent ro'yxati"],
    [ROLES.KAFEDRA_MUDIRI, MODULES.GROUP, "fan biriktirish: Oqim select"],
    [ROLES.DEKAN, MODULES.DIRECTION, "ishchi reja filtri"],
    [ROLES.DEKAN, MODULES.DEPARTMENT, "taqsimot filtri"],
    [ROLES.DEKAN, MODULES.ACADEMIC_YEAR, "ro'yxat filtri"],
    [ROLES.PROREKTOR, MODULES.DIRECTION, "ishchi reja filtri"],
    [ROLES.PROREKTOR, MODULES.DEPARTMENT, "taqsimot filtri"],
    [ROLES.PROREKTOR, MODULES.ACADEMIC_YEAR, "ro'yxat filtri"],
    [ROLES.REJA_MOLIYA, MODULES.DEPARTMENT, "yuklama filtri"],
    [ROLES.REJA_MOLIYA, MODULES.ACADEMIC_YEAR, "yuklama filtri"],
    [ROLES.REKTOR, MODULES.DEPARTMENT, "ro'yxat filtri"],
    [ROLES.ARM, MODULES.ACADEMIC_YEAR, "sillabus/fan dasturi filtri"],
    [ROLES.MAGISTRATURA_BOLIM, MODULES.ACADEMIC_LEVEL, "o'quv reja formasi"],
    [ROLES.MAGISTRATURA_BOLIM, MODULES.READING_FORM, "o'quv reja formasi"],
    [ROLES.MAGISTRATURA_BOLIM, MODULES.SPECIALIZATION, "o'quv reja formasi"],
    [ROLES.MAGISTRATURA_BOLIM, MODULES.STUDY_PERIOD, "o'quv reja formasi"],
  ];

  test.each(NEEDS)("%s → `%s` ro'yxatini o'qiy oladi (%s)", (role, section) => {
    expect(canList(role, section)).toBe(true);
  });

  test("reference grantlari FAQAT o'qish — yozuv amali qo'shilmagan", () => {
    const REFS = [
      MODULES.ACADEMIC_LEVEL, MODULES.EDUCATION_FORM, MODULES.READING_FORM,
      MODULES.SPECIALIZATION, MODULES.STUDY_PERIOD, MODULES.DIRECTION,
      MODULES.COURSE, MODULES.LANGUAGE_OF_INSTRUCTION, MODULES.DEPARTMENT,
      MODULES.ACADEMIC_YEAR,
    ];
    const buzganlar = [];
    for (const [role, def] of Object.entries(ROLE_PERMISSIONS)) {
      for (const ref of REFS) {
        const acts = def.sections?.[ref];
        if (!acts) continue;
        for (const bad of [ACTIONS.CREATE, ACTIONS.UPDATE, ACTIONS.DELETE]) {
          if (acts.includes(bad)) buzganlar.push(`${role}.${ref}:${bad}`);
        }
      }
    }
    expect(buzganlar).toEqual([]);
  });

  test("o'qituvchida reference'dan FAQAT `direction` bor (fan dasturi wizardi uchun)", () => {
    const REFS = [
      MODULES.ACADEMIC_LEVEL, MODULES.EDUCATION_FORM, MODULES.READING_FORM,
      MODULES.SPECIALIZATION, MODULES.STUDY_PERIOD, MODULES.DIRECTION,
      MODULES.COURSE, MODULES.LANGUAGE_OF_INSTRUCTION, MODULES.DEPARTMENT,
      MODULES.ACADEMIC_YEAR, MODULES.GROUP,
    ];
    const bor = REFS.filter((r) => ROLE_PERMISSIONS[ROLES.OQITUVCHI].sections[r]);
    expect(bor).toEqual([MODULES.DIRECTION]);

    expect(ROLE_PERMISSIONS[ROLES.OQITUVCHI].sections[MODULES.DIRECTION]).toEqual([
      ACTIONS.READ_ALL,
    ]);
  });

  test("REKTOR da academicYear/direction YO'Q (practice-roles.seed.js egaligida)", () => {
    const s = ROLE_PERMISSIONS[ROLES.REKTOR].sections;
    expect(s[MODULES.ACADEMIC_YEAR]).toBeUndefined();
    expect(s[MODULES.DIRECTION]).toBeUndefined();
  });

  test("KAFEDRA_MUDIRI da department/academicYear YO'Q (residency-roles.seed.js egaligida)", () => {
    const s = ROLE_PERMISSIONS[ROLES.KAFEDRA_MUDIRI].sections;
    expect(s[MODULES.DEPARTMENT]).toBeUndefined();
    expect(s[MODULES.ACADEMIC_YEAR]).toBeUndefined();
  });

  test("REKTOR da course YO'Q (practice/residency/gifted-roles.seed.js egaligida)", () => {
    const s = ROLE_PERMISSIONS[ROLES.REKTOR].sections;
    expect(s[MODULES.COURSE]).toBeUndefined();
    expect(s[MODULES.DEPARTMENT]).toEqual([ACTIONS.READ_ALL]);
  });
});

describe("OWNERSHIP-GUARD — personalWorkPlan 4.02 da boshqarilmaydi", () => {
  test("hech bir rolda PERSONAL_WORK_PLAN section'i yo'q", () => {
    const buzganlar = Object.entries(ROLE_PERMISSIONS)
      .filter(([, def]) => def.sections[MODULES.PERSONAL_WORK_PLAN])
      .map(([role]) => role);
    expect(buzganlar).toEqual([]);
  });

  test("ROUTE_REQUIREMENTS da ham PERSONAL_WORK_PLAN yo'q", () => {
    const buzganlar = ROUTE_REQUIREMENTS.filter(
      (r) => r.section === MODULES.PERSONAL_WORK_PLAN,
    ).map((r) => r.path);
    expect(buzganlar).toEqual([]);
  });
});

describe("studyLoad.permissions — ROUTE_REQUIREMENTS ↔ ROLE_PERMISSIONS mosligi", () => {
  test.each(ROUTE_REQUIREMENTS.map((r) => [`${r.method} ${r.path}`, r]))(
    "%s — roles ro'yxatidagi har rol permit() dan o'ta oladi",
    (label, requirement) => {
      for (const roleTitle of requirement.roles) {
        const canCall = roleCanCall(roleTitle, requirement.section, requirement.actions);
        expect({
          route: label,
          role: roleTitle,
          section: requirement.section,
          requiredActions: requirement.actions,
          canCall,
        }).toEqual(
          expect.objectContaining({ canCall: true }),
        );
      }
    },
  );

  test("ROUTE_REQUIREMENTS dagi har bandda section MODULES ichida bor", () => {
    for (const req of ROUTE_REQUIREMENTS) {
      expect(CANONICAL_MODULES.has(req.section)).toBe(true);
    }
  });

  test("ROUTE_REQUIREMENTS dagi har bandda actions ACTIONS ichida bor", () => {
    for (const req of ROUTE_REQUIREMENTS) {
      for (const action of req.actions) {
        expect(CANONICAL_ACTIONS.has(action)).toBe(true);
      }
    }
  });
});

describe("REGRESSION-GUARD — oqituvchi WORKLOAD_DISTRIBUTION escalation qaytmasin", () => {
  const oqituvchiDistActions = ROLE_PERMISSIONS[ROLES.OQITUVCHI].sections[MODULES.WORKLOAD_DISTRIBUTION];

  test("oqituvchida UPDATE yo'q (aks holda /approve ni ham chaqira oladi)", () => {
    expect(oqituvchiDistActions).not.toContain(ACTIONS.UPDATE);
  });

  test("oqituvchida APPROVE yo'q (aks holda taqsimotni tasdiqlay oladi)", () => {
    expect(oqituvchiDistActions).not.toContain(ACTIONS.APPROVE);
  });

  test("oqituvchida READ_ALL yo'q (aks holda boshqa kafedralar ma'lumotini ko'radi)", () => {
    expect(oqituvchiDistActions).not.toContain(ACTIONS.READ_ALL);
  });

  test("oqituvchida faqat READ + CHANGE_STATUS bor (kutilgan minimal to'plam)", () => {
    expect([...oqituvchiDistActions].sort()).toEqual(
      [ACTIONS.READ, ACTIONS.CHANGE_STATUS].sort(),
    );
  });

  test("/distributions/approve/:id talabida oqituvchi roles ro'yxatida YO'Q", () => {
    const approveReq = ROUTE_REQUIREMENTS.find(
      (r) => r.path === "/distributions/approve/:id" && r.method === "PATCH",
    );
    expect(approveReq).toBeDefined();
    expect(approveReq.roles).not.toContain(ROLES.OQITUVCHI);
  });
});

describe("REGRESSION-GUARD — kadrlar WORKLOAD_DISTRIBUTION VIEW-ONLY qaytmasin", () => {
  const kadrlarDistActions =
    ROLE_PERMISSIONS[ROLES.KADRLAR].sections[MODULES.WORKLOAD_DISTRIBUTION];

  test("kadrlarda WORKLOAD_DISTRIBUTION granti mavjud", () => {
    expect(kadrlarDistActions).toBeDefined();
  });

  test("kadrlarda aniq [READ, READ_ALL] bor — boshqa hech narsa (kutilgan minimal to'plam)", () => {
    expect([...kadrlarDistActions].sort()).toEqual([ACTIONS.READ, ACTIONS.READ_ALL].sort());
  });

  test("kadrlarda READ bor (kartochka/bitta yozuv — GET /:id, permit() action inference)", () => {
    expect(kadrlarDistActions).toContain(ACTIONS.READ);
  });

  test("kadrlarda READ_ALL bor (vakansiya reyestri — GET /vacancies talabi)", () => {
    expect(kadrlarDistActions).toContain(ACTIONS.READ_ALL);
  });

  test("kadrlarda CREATE YO'Q", () => {
    expect(kadrlarDistActions).not.toContain(ACTIONS.CREATE);
  });

  test("kadrlarda UPDATE YO'Q", () => {
    expect(kadrlarDistActions).not.toContain(ACTIONS.UPDATE);
  });

  test("kadrlarda DELETE YO'Q", () => {
    expect(kadrlarDistActions).not.toContain(ACTIONS.DELETE);
  });

  test("kadrlarda CHANGE_STATUS YO'Q", () => {
    expect(kadrlarDistActions).not.toContain(ACTIONS.CHANGE_STATUS);
  });

  test("kadrlarda APPROVE YO'Q", () => {
    expect(kadrlarDistActions).not.toContain(ACTIONS.APPROVE);
  });

  test("kadrlarda REJECT YO'Q", () => {
    expect(kadrlarDistActions).not.toContain(ACTIONS.REJECT);
  });

  test("kadrlar tasdiqlash/rad etish endpointlari roles ro'yxatida YO'Q (/distributions/approve, /reject)", () => {
    const approveReq = ROUTE_REQUIREMENTS.find(
      (r) => r.path === "/distributions/approve/:id" && r.method === "PATCH",
    );
    const rejectReq = ROUTE_REQUIREMENTS.find(
      (r) => r.path === "/distributions/reject/:id" && r.method === "PATCH",
    );
    expect(approveReq).toBeDefined();
    expect(rejectReq).toBeDefined();
    expect(approveReq.roles).not.toContain(ROLES.KADRLAR);
    expect(rejectReq.roles).not.toContain(ROLES.KADRLAR);
  });

  test("kadrlar scopeLevel — global (vacancies barcha kafedralar bo'yicha ko'rinadi, cheklanmagan)", () => {
    expect(ROLE_PERMISSIONS[ROLES.KADRLAR].scopeLevel).toBe("global");
  });
});

describe("REGRESSION-GUARD — oqituvchi TEACHER_LEAVE huquqlari to'g'ri chegaralangan", () => {
  const oqituvchiLeaveActions = ROLE_PERMISSIONS[ROLES.OQITUVCHI].sections[MODULES.TEACHER_LEAVE];

  test("oqituvchida READ_ALL BOR (o'z arizalarini ro'yxat/paginate orqali ko'rish uchun)", () => {
    expect(oqituvchiLeaveActions).toContain(ACTIONS.READ_ALL);
  });

  test("oqituvchida UPDATE YO'Q (aks holda /approve, /reject, /suggestions, /reassign ni chaqira oladi)", () => {
    expect(oqituvchiLeaveActions).not.toContain(ACTIONS.UPDATE);
  });

  test("oqituvchida APPROVE YO'Q", () => {
    expect(oqituvchiLeaveActions).not.toContain(ACTIONS.APPROVE);
  });

  test("oqituvchida REJECT YO'Q", () => {
    expect(oqituvchiLeaveActions).not.toContain(ACTIONS.REJECT);
  });

  test("oqituvchida DELETE YO'Q", () => {
    expect(oqituvchiLeaveActions).not.toContain(ACTIONS.DELETE);
  });

  test("oqituvchida faqat CREATE + READ + READ_ALL bor (kutilgan minimal to'plam)", () => {
    expect([...oqituvchiLeaveActions].sort()).toEqual(
      [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.READ_ALL].sort(),
    );
  });
});

describe("Vazifa (U) — oqituvchi qoralama DELETE granti (TZ §4.2.6)", () => {
  const syllabusActions = ROLE_PERMISSIONS[ROLES.OQITUVCHI].sections[MODULES.SYLLABUS];
  const scienceProgramActions =
    ROLE_PERMISSIONS[ROLES.OQITUVCHI].sections[MODULES.SCIENCE_PROGRAM];

  test("oqituvchida SYLLABUS uchun DELETE BOR", () => {
    expect(syllabusActions).toContain(ACTIONS.DELETE);
  });

  test("oqituvchida SCIENCE_PROGRAM uchun DELETE BOR", () => {
    expect(scienceProgramActions).toContain(ACTIONS.DELETE);
  });

  test("oqituvchi SYLLABUS to'plami aniq kutilganicha (CREATE/READ/READ_ALL/UPDATE/DELETE)", () => {
    expect([...syllabusActions].sort()).toEqual(
      [
        ACTIONS.CREATE,
        ACTIONS.READ,
        ACTIONS.READ_ALL,
        ACTIONS.UPDATE,
        ACTIONS.DELETE,
      ].sort(),
    );
  });

  test("oqituvchi SCIENCE_PROGRAM to'plami aniq kutilganicha (CREATE/READ/READ_ALL/UPDATE/DELETE)", () => {
    expect([...scienceProgramActions].sort()).toEqual(
      [
        ACTIONS.CREATE,
        ACTIONS.READ,
        ACTIONS.READ_ALL,
        ACTIONS.UPDATE,
        ACTIONS.DELETE,
      ].sort(),
    );
  });

  describe("REGRESSION-LOCK — boshqa zanjir rollarida DELETE qo'shilib qolmagan", () => {
    const CHAIN_ROLES = [
      ROLES.KAFEDRA_MUDIRI,
      ROLES.OQUV_USLUBIY_BOSHQARMA,
      ROLES.PROREKTOR,
      ROLES.REKTOR,
      ROLES.ARM,
    ];

    test.each(CHAIN_ROLES)("%s — SYLLABUS DELETE YO'Q", (role) => {
      const actions = ROLE_PERMISSIONS[role].sections[MODULES.SYLLABUS] || [];
      expect(actions).not.toContain(ACTIONS.DELETE);
    });

    test.each(CHAIN_ROLES)("%s — SCIENCE_PROGRAM DELETE YO'Q", (role) => {
      const actions = ROLE_PERMISSIONS[role].sections[MODULES.SCIENCE_PROGRAM] || [];
      expect(actions).not.toContain(ACTIONS.DELETE);
    });

    test("dekan — SCIENCE_PROGRAM/SYLLABUS: CHAIN_APPROVER bo'lsa ham DELETE/CREATE YO'Q", () => {
      const sp = ROLE_PERMISSIONS[ROLES.DEKAN].sections[MODULES.SCIENCE_PROGRAM];
      const syl = ROLE_PERMISSIONS[ROLES.DEKAN].sections[MODULES.SYLLABUS];
      expect(sp).not.toContain(ACTIONS.DELETE);
      expect(sp).not.toContain(ACTIONS.CREATE);
      expect(syl).not.toContain(ACTIONS.DELETE);
      expect(syl).not.toContain(ACTIONS.CREATE);
    });
  });
});

describe("studyPlan PDF — `export` vakolati `read` dan ajratilgan", () => {
  const PDF_ACTIONS = [ACTIONS.EXPORT];

  test("O'UB PDF ola oladi (reja egasi — default beriladi)", () => {
    expect(
      roleCanCall(ROLES.OQUV_USLUBIY_BOSHQARMA, MODULES.STUDY_PLAN, PDF_ACTIONS),
    ).toBe(true);
  });

  test.each([[ROLES.DEKAN], [ROLES.REKTOR]])(
    "%s PDF ola oladi (VIEW_ONLY ichida EXPORT bor edi)",
    (role) => {
      expect(roleCanCall(role, MODULES.STUDY_PLAN, PDF_ACTIONS)).toBe(true);
    },
  );

  test("🔴 `export` — `read` dan ALOHIDA kalit (admin o'chira olsin)", () => {
    expect(ACTIONS.EXPORT).not.toBe(ACTIONS.READ);
    expect(ACTIONS.EXPORT).not.toBe(ACTIONS.READ_ALL);
  });

  test("faqat `read` bor rol PDF ola OLMAYDI", () => {
    const readOnly = { sections: { [MODULES.STUDY_PLAN]: [ACTIONS.READ] } };
    const has = (readOnly.sections[MODULES.STUDY_PLAN] || []).some((a) =>
      PDF_ACTIONS.includes(a),
    );
    expect(has).toBe(false);
  });
});

describe("contingentReport — rol grantlari (ADR-036, egasi qarori S1)", () => {
  const sec = (role) => ROLE_PERMISSIONS[role]?.sections?.[MODULES.CONTINGENT_REPORT];

  test("dekan — hujjat egasi: create/read/readAll/update/approve/reject/export/delete", () => {
    expect([...sec(ROLES.DEKAN)].sort()).toEqual(
      [
        ACTIONS.CREATE,
        ACTIONS.READ,
        ACTIONS.READ_ALL,
        ACTIONS.UPDATE,
        ACTIONS.APPROVE,
        ACTIONS.REJECT,
        ACTIONS.EXPORT,
        ACTIONS.DELETE,
      ].sort(),
    );
  });

  test("fakultet_kengash_kotibi — tuzadi/yuboradi, lekin approve/reject/delete YO'Q", () => {
    const actions = sec(ROLES.FAKULTET_KENGASH_KOTIBI);
    expect([...actions].sort()).toEqual(
      [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.UPDATE, ACTIONS.EXPORT].sort(),
    );
    expect(actions).not.toContain(ACTIONS.APPROVE);
    expect(actions).not.toContain(ACTIONS.REJECT);
    expect(actions).not.toContain(ACTIONS.DELETE);
  });

  test("kotib bloki FAQAT contingentReport boshqaradi (4.03 egaligi — personalWorkPlan/academicYear bu yerda YO'Q)", () => {
    expect(Object.keys(ROLE_PERMISSIONS[ROLES.FAKULTET_KENGASH_KOTIBI].sections)).toEqual([
      MODULES.CONTINGENT_REPORT,
    ]);
    expect(ROLE_PERMISSIONS[ROLES.FAKULTET_KENGASH_KOTIBI].scopeLevel).toBe("faculty");
  });

  test.each([ROLES.OQUV_USLUBIY_BOSHQARMA, ROLES.REKTOR, ROLES.PROREKTOR])(
    "%s — kuzatuvchi: faqat read/readAll/export (yozuv granti yo'q, ADR-001)",
    (role) => {
      expect([...sec(role)].sort()).toEqual([ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.EXPORT].sort());
    },
  );

  test.each([ROLES.OQITUVCHI, ROLES.KAFEDRA_MUDIRI, ROLES.REJA_MOLIYA, ROLES.ARM, ROLES.KADRLAR, ROLES.MAGISTRATURA_BOLIM])(
    "%s — contingentReport bo'limi UMUMAN YO'Q (fakultet/institut darajasidan tashqari rol)",
    (role) => {
      expect(sec(role)).toBeUndefined();
    },
  );
});
