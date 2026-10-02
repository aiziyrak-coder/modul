jest.mock("./personalWorkPlan.model");
jest.mock("#modules/4.03-teacher/_verify/workPlanVerify.service", () => ({
  issueOrRefresh: jest.fn().mockResolvedValue(null),
  revoke: jest.fn(),
}));
jest.mock("#modules/4.03-teacher/_shared/chainNotify", () => ({
  safeDispatch: jest.fn().mockResolvedValue(undefined),
  safeDispatchMany: jest.fn().mockResolvedValue(undefined),
  getRecipients: jest.fn().mockResolvedValue([]),
  getRecipientsForSteps: jest.fn().mockResolvedValue([]),
  describeOwner: jest.fn().mockResolvedValue(""),
}));

const PersonalWorkPlanModel = require("./personalWorkPlan.model");
const Controller = require("./personalWorkPlan.controller");
const { ROLES } = require("#config/constants");
const { GROUPS: CHAIN_GROUPS } = require("#modules/4.03-teacher/_shared/workPlanChain");

const PLAN_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const ACT_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const TEACHER_ID = "cccccccccccccccccccccccc";
const SCOPE = { teacher: { $in: [TEACHER_ID] } };

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

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const userWithRole = (title, id = "userid") => ({ _id: id, role: { title } });

const buildApprovals = (overrides = {}) =>
  STEP_KEYS.map((step) => ({
    step,
    label: step,
    status: overrides[step] || "pending",
    approvedBy: null,
    date: null,
    comment: null,
    eriSignature: null,
    eriSerial: null,
    eriSignedAt: null,
  }));

const priorApproved = (step) => {
  const idx = CHAIN_GROUPS.findIndex((g) => g.steps.includes(step));
  const overrides = {};
  CHAIN_GROUPS.slice(0, idx).forEach((g) =>
    g.steps.forEach((s) => {
      overrides[s] = "approved";
    }),
  );
  return overrides;
};

const planDoc = ({ status = "draft", approvals, teacher = TEACHER_ID, item = null } = {}) => {
  const makeSection = () => {
    const arr = [];
    arr.id = jest.fn().mockReturnValue(item);
    return arr;
  };
  return {
    _id: PLAN_ID,
    teacher,
    status,
    approvals: approvals || buildApprovals(),
    methodicalWork: [],
    researchWork: makeSection(),
    mentoringWork: makeSection(),
    organizationalWork: makeSection(),
    extraWork: makeSection(),
    save: jest.fn().mockResolvedValue(undefined),
  };
};

const mockFound = (doc) => {
  PersonalWorkPlanModel.findOne = jest.fn().mockResolvedValue(doc);
};

const call = async (
  handler,
  { params = {}, body = {}, scope = SCOPE, user = userWithRole(ROLES.OQITUVCHI, TEACHER_ID) } = {},
) => {
  const res = createRes();
  await handler({ params: { id: PLAN_ID, ...params }, body, scope, user }, res, jest.fn());
  return res;
};

const callNext = async (handler, opts = {}) => {
  const res = createRes();
  const next = jest.fn();
  await handler(
    {
      params: { id: PLAN_ID, ...(opts.params || {}) },
      body: opts.body || {},
      scope: opts.scope || SCOPE,
      user: opts.user || userWithRole(ROLES.OQITUVCHI, TEACHER_ID),
    },
    res,
    next,
  );
  return { res, next };
};

beforeEach(() => jest.clearAllMocks());

describe("TZ 4.3.4 — faoliyat bo'limlari", () => {
  const VALID = [
    "researchWork",
    "mentoringWork",
    "organizationalWork",
    "extraWork",
  ];

  test.each(VALID)("`%s` — qabul qilinadi", async (section) => {
    const doc = planDoc();
    mockFound(doc);

    const res = await call(Controller.addActivity, {
      body: { section, item: { title: "Maqola" } },
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(doc[section]).toHaveLength(1);
    expect(doc.save).toHaveBeenCalled();
  });

  test("`teachingLoad` — RAD etiladi (I bo'lim avtomatik, qo'lda emas)", async () => {
    mockFound(planDoc());

    const res = await call(Controller.addActivity, {
      body: { section: "teachingLoad", item: {} },
    });

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("noma'lum bo'lim — 400", async () => {
    mockFound(planDoc());

    const res = await call(Controller.addActivity, {
      body: { section: "hackerWork", item: {} },
    });

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("bo'lim tekshiruvi DB so'rovidan OLDIN (keraksiz so'rov ketmasin)", async () => {
    PersonalWorkPlanModel.findOne = jest.fn();

    await call(Controller.addActivity, { body: { section: "yomon", item: {} } });

    expect(PersonalWorkPlanModel.findOne).not.toHaveBeenCalled();
  });
});

describe("Faoliyatni bajarildi deb belgilash (TZ 4.3.4)", () => {
  test("status `completed` bo'ladi va sana yoziladi", async () => {
    const item = { status: "planned", completedAt: null, fileUrl: null };
    mockFound(planDoc({ status: "approved", item }));

    const res = await call(Controller.completeActivity, {
      params: { activityId: ACT_ID },
      body: { section: "researchWork", fileUrl: "/files/maqola.pdf" },
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(item.status).toBe("completed");
    expect(item.completedAt).toBeInstanceOf(Date);
  });

  test("faoliyat topilmasa — 404", async () => {
    mockFound(planDoc({ item: null }));

    const res = await call(Controller.completeActivity, {
      params: { activityId: ACT_ID },
      body: { section: "researchWork" },
    });

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("Tasdiqlash zanjiri", () => {
  describe("submit — draft → submitted (1-bosqich, oqituvchi o'zi)", () => {
    test("draft → submitted, `teacher` bosqichi approved bo'ladi", async () => {
      const doc = planDoc({ status: "draft" });
      mockFound(doc);

      const res = await call(Controller.submitWorkPlan);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(doc.status).toBe("submitted");
      const step = doc.approvals.find((s) => s.step === "teacher");
      expect(step.status).toBe("approved");
      expect(step.approvedBy).toBe(TEACHER_ID);
    });

    test.each(["submitted", "approved", "rejected", "completed"])(
      "`%s` holatdan — 400 (faqat draft)",
      async (status) => {
        const doc = planDoc({ status });
        mockFound(doc);

        const { next } = await callNext(Controller.submitWorkPlan);

        expect(next.mock.calls[0][0].statusCode).toBe(400);
        expect(doc.status).toBe(status);
      },
    );
  });

  describe("approve — 1-bosqich (draft holatda, faqat rejaning egasi)", () => {
    test("oqituvchi (rejaning egasi) tasdiqlaydi — draft → submitted", async () => {
      const doc = planDoc({ status: "draft" });
      mockFound(doc);

      const res = await call(Controller.approveWorkPlan);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(doc.status).toBe("submitted");
      const json = res.json.mock.calls[0][0];
      expect(json.approvedStep).toBe("teacher");
    });

    test("🔴 SECURITY: begona o'qituvchi (rejaning egasi emas) — 403, holat o'zgarmaydi", async () => {
      const doc = planDoc({ status: "draft", teacher: TEACHER_ID });
      mockFound(doc);

      const { res, next } = await callNext(Controller.approveWorkPlan, {
        user: userWithRole(ROLES.OQITUVCHI, "boshqa-oqituvchi-id"),
      });

      expect(res.status).not.toHaveBeenCalledWith(200);
      expect(next.mock.calls[0][0].statusCode).toBe(403);
      expect(doc.status).toBe("draft");
    });

    test("🔴 SECURITY: kafedra_mudiri 1-bosqichni tasdiqlay olmaydi (faqat oqituvchi)", async () => {
      const doc = planDoc({ status: "draft" });
      mockFound(doc);

      const { next } = await callNext(Controller.approveWorkPlan, {
        user: userWithRole(ROLES.KAFEDRA_MUDIRI),
      });

      expect(next.mock.calls[0][0].statusCode).toBe(403);
      expect(doc.status).toBe("draft");
    });

    test("super_admin bypass — draft holatda 'teacher' bosqichini bajaradi", async () => {
      const doc = planDoc({ status: "draft" });
      mockFound(doc);

      const res = await call(Controller.approveWorkPlan, {
        user: userWithRole(ROLES.SUPER_ADMIN),
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(doc.status).toBe("submitted");
      expect(res.json.mock.calls[0][0].approvedStep).toBe("teacher");
    });
  });

  describe("approve — 2-8-bosqich (GURUHLI KETMA-KETLIK, ADR-023 Qaror #6)", () => {
    test.each([
      [ROLES.KAFEDRA_USLUBIY_MASUL, "kafedraUslubiy"],
      [ROLES.KAFEDRA_ILMIY_MASUL, "kafedraIlmiy"],
      [ROLES.KAFEDRA_USTOZ_SHOGIRD_MASUL, "kafedraUstozShogird"],
      [ROLES.KAFEDRA_MUDIRI, "kafedraMudiri"],
      [ROLES.OQUV_USLUBIY_BOSHQARMA, "oquvUslubiy"],
      [ROLES.DEKAN, "dekan"],
      [ROLES.ICHKI_NAZORAT, "ichkiNazorat"],
    ])("%s — o'z guruhi navbati kelganda o'z bosqichini (%s) tasdiqlaydi", async (roleTitle, step) => {
      const doc = planDoc({
        status: "submitted",
        approvals: buildApprovals(priorApproved(step)),
      });
      mockFound(doc);

      const res = await call(Controller.approveWorkPlan, {
        user: userWithRole(roleTitle),
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(doc.approvals.find((s) => s.step === step).status).toBe("approved");
    });

    test.each([
      ["kafedraIlmiy", ROLES.KAFEDRA_ILMIY_MASUL],
      ["kafedraUstozShogird", ROLES.KAFEDRA_USTOZ_SHOGIRD_MASUL],
      ["kafedraUslubiy", ROLES.KAFEDRA_USLUBIY_MASUL],
    ])(
      "G1 ICHIDA tartib yo'q — '%s' boshqa ikkitasini kutmasdan tasdiqlanadi",
      async (step, roleTitle) => {
        const doc = planDoc({
          status: "submitted",
          approvals: buildApprovals({ teacher: "approved" }),
        });
        mockFound(doc);

        const res = await call(Controller.approveWorkPlan, {
          user: userWithRole(roleTitle),
        });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(doc.approvals.find((s) => s.step === step).status).toBe("approved");
      },
    );

    test("🔴 GURUH NAVBATI: kafedraMudiri (G2) — G1 tugamasdan 409", async () => {
      const doc = planDoc({
        status: "submitted",
        approvals: buildApprovals({ teacher: "approved" }),
      });
      mockFound(doc);

      const { next } = await callNext(Controller.approveWorkPlan, {
        user: userWithRole(ROLES.KAFEDRA_MUDIRI),
      });

      expect(next.mock.calls[0][0].statusCode).toBe(409);
      expect(doc.approvals.find((s) => s.step === "kafedraMudiri").status).toBe(
        "pending",
      );
    });

    test("🔴 SECURITY: klient `body.step`ni spoof qilsa E'TIBORSIZ qoldiriladi", async () => {
      const doc = planDoc({
        status: "submitted",
        approvals: buildApprovals(priorApproved("kafedraMudiri")),
      });
      mockFound(doc);

      const res = await call(Controller.approveWorkPlan, {
        user: userWithRole(ROLES.KAFEDRA_MUDIRI),
        body: { step: "dekan" },
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(doc.approvals.find((s) => s.step === "kafedraMudiri").status).toBe(
        "approved",
      );
      expect(doc.approvals.find((s) => s.step === "dekan").status).toBe("pending");
    });

    test("🔴 SECURITY: bosqich allaqachon approved — 400 (ikki marta tasdiqlash yo'q)", async () => {
      const doc = planDoc({
        status: "submitted",
        approvals: buildApprovals({
          ...priorApproved("kafedraMudiri"),
          kafedraMudiri: "approved",
        }),
      });
      mockFound(doc);

      const { next } = await callNext(Controller.approveWorkPlan, {
        user: userWithRole(ROLES.KAFEDRA_MUDIRI),
      });

      expect(next.mock.calls[0][0].statusCode).toBe(400);
    });

    test("rolga mos bosqich yo'q (masalan `kadrlar`) — 403", async () => {
      const doc = planDoc({
        status: "submitted",
        approvals: buildApprovals({ teacher: "approved" }),
      });
      mockFound(doc);

      const { next } = await callNext(Controller.approveWorkPlan, {
        user: userWithRole(ROLES.KADRLAR),
      });

      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });

    test("super_admin — `body.step`siz 400 (bosqichni ko'rsatishi SHART)", async () => {
      const doc = planDoc({
        status: "submitted",
        approvals: buildApprovals({ teacher: "approved" }),
      });
      mockFound(doc);

      const { next } = await callNext(Controller.approveWorkPlan, {
        user: userWithRole(ROLES.SUPER_ADMIN),
      });

      expect(next.mock.calls[0][0].statusCode).toBe(400);
    });

    test("super_admin — G1 tugamasdan HAM 'dekan' (G4) bosqichini tasdiqlaydi (tiqilishni ochish)", async () => {
      const doc = planDoc({
        status: "submitted",
        approvals: buildApprovals({ teacher: "approved" }),
      });
      mockFound(doc);

      const { next } = await callNext(Controller.approveWorkPlan, {
        user: userWithRole(ROLES.SUPER_ADMIN),
        body: { step: "dekan" },
      });

      expect(next).not.toHaveBeenCalled();
      expect(doc.approvals.find((s) => s.step === "dekan").status).toBe(
        "approved",
      );
    });

    test("super_admin — `body.step` bilan, guruh navbati kelgan bosqichni tasdiqlaydi, javobda ko'rsatiladi", async () => {
      const doc = planDoc({
        status: "submitted",
        approvals: buildApprovals(priorApproved("dekan")),
      });
      mockFound(doc);

      const res = await call(Controller.approveWorkPlan, {
        user: userWithRole(ROLES.SUPER_ADMIN),
        body: { step: "dekan" },
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(doc.approvals.find((s) => s.step === "dekan").status).toBe("approved");
      expect(res.json.mock.calls[0][0].approvedStep).toBe("dekan");
    });

    test("2-8 bosqichning HAMMASI approved bo'lgach — reja `approved`ga o'tadi", async () => {
      const approvals = buildApprovals({
        teacher: "approved",
        kafedraUslubiy: "approved",
        kafedraIlmiy: "approved",
        kafedraUstozShogird: "approved",
        kafedraMudiri: "approved",
        oquvUslubiy: "approved",
        dekan: "approved",
      });
      const doc = planDoc({ status: "submitted", approvals });
      mockFound(doc);

      const res = await call(Controller.approveWorkPlan, {
        user: userWithRole(ROLES.ICHKI_NAZORAT),
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(doc.status).toBe("approved");
      expect(doc.approvedBy).toBeTruthy();
    });

    test("hammasi approved bo'lmasa — reja `submitted`da qoladi", async () => {
      const doc = planDoc({
        status: "submitted",
        approvals: buildApprovals({ teacher: "approved" }),
      });
      mockFound(doc);

      await call(Controller.approveWorkPlan, {
        user: userWithRole(ROLES.KAFEDRA_USLUBIY_MASUL),
      });

      expect(doc.status).toBe("submitted");
    });
  });

  describe("approve — approved/rejected/completed holatlarda amal qilib bo'lmaydi", () => {
    test.each(["approved", "rejected", "completed"])("`%s` holatdan — 400", async (status) => {
      const doc = planDoc({ status });
      mockFound(doc);

      const { next } = await callNext(Controller.approveWorkPlan, {
        user: userWithRole(ROLES.KAFEDRA_MUDIRI),
      });

      expect(next.mock.calls[0][0].statusCode).toBe(400);
      expect(doc.status).toBe(status);
    });
  });

  describe("reject — faqat submitted holatda, `oqituvchi` HECH QACHON rad eta olmaydi", () => {
    test("mos bosqich roli (guruh navbati kelgan) rad etadi — butun reja `rejected`ga o'tadi", async () => {
      const doc = planDoc({
        status: "submitted",
        approvals: buildApprovals(priorApproved("kafedraMudiri")),
      });
      mockFound(doc);

      const res = await call(Controller.rejectWorkPlan, {
        user: userWithRole(ROLES.KAFEDRA_MUDIRI),
        body: { comment: "Yetarli emas" },
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(doc.status).toBe("rejected");
      expect(doc.approvals.find((s) => s.step === "kafedraMudiri").status).toBe(
        "rejected",
      );
    });

    test("🔴 GURUH NAVBATI: kafedraMudiri (G2) — G1 tugamasdan rad etolmaydi (409)", async () => {
      const doc = planDoc({
        status: "submitted",
        approvals: buildApprovals({ teacher: "approved" }),
      });
      mockFound(doc);

      const { next } = await callNext(Controller.rejectWorkPlan, {
        user: userWithRole(ROLES.KAFEDRA_MUDIRI),
        body: { comment: "Yetarli emas" },
      });

      expect(next.mock.calls[0][0].statusCode).toBe(409);
      expect(doc.status).toBe("submitted");
    });

    test.each(["draft", "approved", "rejected", "completed"])(
      "`%s` holatdan — 400 (faqat submitted)",
      async (status) => {
        const doc = planDoc({ status });
        mockFound(doc);

        const { next } = await callNext(Controller.rejectWorkPlan, {
          user: userWithRole(ROLES.KAFEDRA_MUDIRI),
          body: { comment: "x" },
        });

        expect(next.mock.calls[0][0].statusCode).toBe(400);
        expect(doc.status).toBe(status);
      },
    );

    test("rolga mos bosqich yo'q — 403", async () => {
      const doc = planDoc({
        status: "submitted",
        approvals: buildApprovals({ teacher: "approved" }),
      });
      mockFound(doc);

      const { next } = await callNext(Controller.rejectWorkPlan, {
        user: userWithRole(ROLES.KADRLAR),
        body: { comment: "x" },
      });

      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });

    test("'teacher' bosqichi (1-bosqich) hech qachon rad etilmaydi — 400", async () => {
      const doc = planDoc({
        status: "submitted",
        approvals: buildApprovals({ teacher: "approved" }),
      });
      mockFound(doc);

      const { next } = await callNext(Controller.rejectWorkPlan, {
        user: userWithRole(ROLES.SUPER_ADMIN),
        body: { comment: "x", step: "teacher" },
      });

      expect(next.mock.calls[0][0].statusCode).toBe(400);
      expect(doc.status).toBe("submitted");
    });
  });

  describe("reopen — rejected → draft, BARCHA bosqichlar pending'ga tozalanadi", () => {
    test("8 bosqich ham pending bo'ladi, eski izoh/imzolar tozalanadi", async () => {
      const approvals = buildApprovals({ teacher: "approved", kafedraMudiri: "rejected" });
      approvals.find((s) => s.step === "kafedraMudiri").comment = "eski izoh";
      approvals.find((s) => s.step === "kafedraMudiri").eriSignature = "TEMP_ERI_PLACEHOLDER";
      const doc = planDoc({ status: "rejected", approvals });
      mockFound(doc);

      const res = await call(Controller.reopenWorkPlan);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(doc.status).toBe("draft");
      expect(doc.approvals.every((s) => s.status === "pending")).toBe(true);
      expect(doc.approvals.every((s) => s.comment === null)).toBe(true);
      expect(doc.approvals.every((s) => s.eriSignature === null)).toBe(true);
    });

    test.each(["draft", "submitted", "approved", "completed"])(
      "`%s` holatdan — 400 (faqat rejected)",
      async (status) => {
        const doc = planDoc({ status });
        mockFound(doc);

        const { next } = await callNext(Controller.reopenWorkPlan);

        expect(next.mock.calls[0][0].statusCode).toBe(400);
        expect(doc.status).toBe(status);
      },
    );
  });

  describe("complete — approved → completed, FAQAT ichki_nazorat, barcha ishlar bajarilgan bo'lsa", () => {
    const allApproved = buildApprovals({
      teacher: "approved",
      kafedraUslubiy: "approved",
      kafedraIlmiy: "approved",
      kafedraUstozShogird: "approved",
      kafedraMudiri: "approved",
      oquvUslubiy: "approved",
      dekan: "approved",
      ichkiNazorat: "approved",
    });

    const finishedPlan = (status = "approved") => {
      const doc = planDoc({ status, approvals: allApproved.map((s) => ({ ...s })) });
      const done = () => ({ status: "completed", verification: { status: "approved" } });
      doc.methodicalWork = [done()];
      doc.researchWork = [done()];
      doc.mentoringWork = [];
      doc.organizationalWork = [];
      doc.extraWork = [];
      return doc;
    };

    test("barcha ishlar bajarilgan — `completed`ga o'tadi", async () => {
      const doc = finishedPlan();
      mockFound(doc);

      const res = await call(Controller.completeWorkPlan, {
        user: userWithRole(ROLES.ICHKI_NAZORAT),
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(doc.status).toBe("completed");
    });

    test("🔴 SECURITY: boshqa rol (kafedra_mudiri) yakunlay olmaydi — 403", async () => {
      const doc = finishedPlan();
      mockFound(doc);

      const { next } = await callNext(Controller.completeWorkPlan, {
        user: userWithRole(ROLES.KAFEDRA_MUDIRI),
      });

      expect(next.mock.calls[0][0].statusCode).toBe(403);
      expect(doc.status).toBe("approved");
    });

    test("bajarilmagan ish qolsa — 400", async () => {
      const doc = finishedPlan();
      doc.researchWork = [{ status: "planned" }];
      mockFound(doc);

      const { next } = await callNext(Controller.completeWorkPlan, {
        user: userWithRole(ROLES.ICHKI_NAZORAT),
      });

      expect(next.mock.calls[0][0].statusCode).toBe(400);
      expect(doc.status).toBe("approved");
    });

    test.each([
      ["tekshiruvda (pending)", "pending"],
      ["mudir qaytargan (rejected)", "rejected"],
    ])("D-21: dalil %s — 400, reja yakunlanmaydi", async (_label, verification) => {
      const doc = finishedPlan();
      doc.researchWork = [{ status: "completed", verification: { status: verification } }];
      mockFound(doc);

      const { next } = await callNext(Controller.completeWorkPlan, {
        user: userWithRole(ROLES.ICHKI_NAZORAT),
      });

      expect(next.mock.calls[0][0].statusCode).toBe(400);
      expect(next.mock.calls[0][0].message).toContain("1 ta ish dalili");
      expect(doc.status).toBe("approved");
    });

    test("`approved` bo'lmagan holatdan — 400", async () => {
      const doc = finishedPlan("submitted");
      mockFound(doc);

      const { next } = await callNext(Controller.completeWorkPlan, {
        user: userWithRole(ROLES.ICHKI_NAZORAT),
      });

      expect(next.mock.calls[0][0].statusCode).toBe(400);
    });

    test("super_admin bypass — yakunlashi mumkin", async () => {
      const doc = finishedPlan();
      mockFound(doc);

      const res = await call(Controller.completeWorkPlan, {
        user: userWithRole(ROLES.SUPER_ADMIN),
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(doc.status).toBe("completed");
    });
  });
});

describe("REGRESSION-GUARD — barcha `/:id` handlerlar scope bilan qidirsin", () => {
  test.each([
    ["submitWorkPlan", Controller.submitWorkPlan],
    ["reopenWorkPlan", Controller.reopenWorkPlan],
    ["addActivity", Controller.addActivity],
  ])("%s — `findOne({_id, ...scope})` bilan", async (_n, handler) => {
    mockFound(planDoc({ status: "draft" }));

    await call(handler, { body: { section: "researchWork", item: {} } });

    expect(PersonalWorkPlanModel.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: PLAN_ID, teacher: SCOPE.teacher }),
    );
  });

  test("controller faylida `findById` umuman qolmagan", () => {
    const fs = require("fs");
    const src = fs.readFileSync(
      require.resolve("./personalWorkPlan.controller"),
      "utf8",
    );
    expect(src).not.toMatch(/PersonalWorkPlanModel\.findById/);
  });

  test("service faylida ham `findById` yo'q (A2-BE-2)", () => {
    const fs = require("fs");
    const src = fs.readFileSync(
      require.resolve("./personalWorkPlan.service"),
      "utf8",
    );
    expect(src).not.toMatch(/PersonalWorkPlanModel\.findById/);
  });
});
