jest.mock("./personalWorkPlan.model");

const PersonalWorkPlanModel = require("./personalWorkPlan.model");
const Controller = require("./personalWorkPlan.controller");
const service = require("./personalWorkPlan.service");
const {
  completeActivitySchema,
  verifyActivitySchema,
  EDITABLE_SECTIONS,
} = require("./personalWorkPlan.validation");
const { ROLES } = require("#config/constants");

const PLAN_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const ACT_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const TEACHER_ID = "cccccccccccccccccccccccc";
const SCOPE = { teacher: { $in: [TEACHER_ID] } };

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const userWithRole = (title, id = "userid") => ({ _id: id, role: { title } });

const planDoc = ({ teacher = TEACHER_ID, item = null } = {}) => {
  const makeSection = () => {
    const arr = [];
    arr.id = jest.fn().mockReturnValue(item);
    return arr;
  };
  return {
    _id: PLAN_ID,
    teacher,
    status: "approved",
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
  { params = {}, body = {}, query = {}, scope = SCOPE, user = userWithRole(ROLES.OQITUVCHI, TEACHER_ID) } = {},
) => {
  const res = createRes();
  const next = jest.fn();
  await handler({ params: { id: PLAN_ID, ...params }, body, query, scope, user }, res, next);
  return { res, next };
};

beforeEach(() => jest.clearAllMocks());

describe("Joi — completeActivitySchema (PATCH .../complete)", () => {
  test("`section` majburiy, `link`/`fileUrl` ixtiyoriy", () => {
    const { error } = completeActivitySchema.validate({ section: "researchWork" });
    expect(error).toBeUndefined();
  });

  test("`link` bilan qabul qilinadi", () => {
    const { error, value } = completeActivitySchema.validate({
      section: "researchWork",
      link: "https://scopus.com/x",
    });
    expect(error).toBeUndefined();
    expect(value.link).toBe("https://scopus.com/x");
  });

  test("noma'lum `section` RAD etiladi", () => {
    const { error } = completeActivitySchema.validate({ section: "hacker" });
    expect(error).toBeDefined();
  });
});

describe("Joi — verifyActivitySchema (PATCH .../verify)", () => {
  test("`decision: approved` — `comment`siz qabul qilinadi", () => {
    const { error } = verifyActivitySchema.validate({
      section: "researchWork",
      decision: "approved",
    });
    expect(error).toBeUndefined();
  });

  test("`decision: rejected` — `comment`siz RAD etiladi (dizayn: \"Qaytarish sababi*\")", () => {
    const { error } = verifyActivitySchema.validate({
      section: "researchWork",
      decision: "rejected",
    });
    expect(error).toBeDefined();
  });

  test("`decision: rejected` — `comment` bilan qabul qilinadi", () => {
    const { error } = verifyActivitySchema.validate({
      section: "researchWork",
      decision: "rejected",
      comment: "Hujjat yetarli emas",
    });
    expect(error).toBeUndefined();
  });

  test("noma'lum `decision` qiymati RAD etiladi", () => {
    const { error } = verifyActivitySchema.validate({
      section: "researchWork",
      decision: "maybe",
    });
    expect(error).toBeDefined();
  });
});

describe("completeActivity — tekshiruv navbatiga qo'shish (A2-BE-3a)", () => {
  test("bajarilgan deb belgilanganda `verification.status` = 'pending'", async () => {
    const item = { status: "planned", completedAt: null, fileUrl: null, link: null };
    mockFound(planDoc({ item }));

    const { res } = await call(Controller.completeActivity, {
      params: { activityId: ACT_ID },
      body: { section: "researchWork" },
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(item.status).toBe("completed");
    expect(item.verification.status).toBe("pending");
  });

  test("`link` berilsa elementga yoziladi", async () => {
    const item = { status: "planned", completedAt: null, fileUrl: null, link: null };
    mockFound(planDoc({ item }));

    await call(Controller.completeActivity, {
      params: { activityId: ACT_ID },
      body: { section: "researchWork", link: "https://scopus.com/record/1" },
    });

    expect(item.link).toBe("https://scopus.com/record/1");
  });

  test("ilgari 'rejected' bo'lgan element qayta bajarilsa — eski `comment` tozalanadi", async () => {
    const item = {
      status: "planned",
      completedAt: null,
      fileUrl: null,
      link: null,
      verification: {
        status: "rejected",
        reviewedBy: "reviewer-id",
        date: new Date("2026-01-01"),
        comment: "Hujjat yetarli emas",
      },
    };
    mockFound(planDoc({ item }));

    await call(Controller.completeActivity, {
      params: { activityId: ACT_ID },
      body: { section: "researchWork" },
    });

    expect(item.verification.status).toBe("pending");
    expect(item.verification.comment).toBeNull();
    expect(item.verification.reviewedBy).toBeNull();
    expect(item.verification.date).toBeNull();
  });
});

describe("verifyActivity (service) — A2-BE-3a", () => {
  const completedPendingItem = () => ({
    _id: ACT_ID,
    status: "completed",
    verification: { status: "pending", reviewedBy: null, date: null, comment: null },
  });

  test("kafedra_mudiri tasdiqlaydi — verification.status 'approved' bo'ladi", async () => {
    const item = completedPendingItem();
    const doc = planDoc({ item });
    mockFound(doc);

    const { item: result } = await service.verifyActivity(
      PLAN_ID, ACT_ID,
      userWithRole(ROLES.KAFEDRA_MUDIRI, "reviewer-1"),
      SCOPE,
      { section: "researchWork", decision: "approved" },
    );

    expect(result.verification.status).toBe("approved");
    expect(result.verification.reviewedBy).toBe("reviewer-1");
    expect(result.verification.comment).toBeNull();
    expect(doc.save).toHaveBeenCalled();
  });

  test("ilmiy_bolim qaytaradi (sabab bilan) — verification.status 'rejected', item.status 'completed' qoladi", async () => {
    const item = completedPendingItem();
    mockFound(planDoc({ item }));

    const { item: result } = await service.verifyActivity(
      PLAN_ID, ACT_ID,
      userWithRole(ROLES.ILMIY_BOLIM, "reviewer-2"),
      {},
      { section: "researchWork", decision: "rejected", comment: "Havola noto'g'ri" },
    );

    expect(result.verification.status).toBe("rejected");
    expect(result.verification.comment).toBe("Havola noto'g'ri");
    expect(result.status).toBe("completed");
  });

  test("super_admin bypass — VERIFIER_ROLES'da bo'lmasa ham tekshira oladi", async () => {
    const item = completedPendingItem();
    mockFound(planDoc({ item }));

    const { item: result } = await service.verifyActivity(
      PLAN_ID, ACT_ID,
      userWithRole(ROLES.SUPER_ADMIN),
      {},
      { section: "researchWork", decision: "approved" },
    );

    expect(result.verification.status).toBe("approved");
  });

  test("🔴 SECURITY: oqituvchi (permit()da APPROVE bor bo'lsa ham) — 403, DB so'rovi qilinmaydi", async () => {
    PersonalWorkPlanModel.findOne = jest.fn();

    await expect(
      service.verifyActivity(
        PLAN_ID, ACT_ID,
        userWithRole(ROLES.OQITUVCHI, TEACHER_ID),
        SCOPE,
        { section: "researchWork", decision: "approved" },
      ),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(PersonalWorkPlanModel.findOne).not.toHaveBeenCalled();
  });

  test("dekan (approve/reject huquqi bor, lekin VERIFIER_ROLES emas) — 403", async () => {
    await expect(
      service.verifyActivity(
        PLAN_ID, ACT_ID,
        userWithRole(ROLES.DEKAN),
        {},
        { section: "researchWork", decision: "approved" },
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  test("faqat 'completed' bo'lmagan elementni tekshirib bo'lmaydi — 400", async () => {
    const item = { _id: ACT_ID, status: "planned", verification: { status: "pending" } };
    mockFound(planDoc({ item }));

    await expect(
      service.verifyActivity(
        PLAN_ID, ACT_ID,
        userWithRole(ROLES.KAFEDRA_MUDIRI),
        SCOPE,
        { section: "researchWork", decision: "approved" },
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test("ikki marta tekshirib bo'lmaydi — 'pending' bo'lmagan elementda 400", async () => {
    const item = {
      _id: ACT_ID,
      status: "completed",
      verification: { status: "approved", reviewedBy: "x", date: new Date(), comment: null },
    };
    mockFound(planDoc({ item }));

    await expect(
      service.verifyActivity(
        PLAN_ID, ACT_ID,
        userWithRole(ROLES.KAFEDRA_MUDIRI),
        SCOPE,
        { section: "researchWork", decision: "rejected", comment: "x" },
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test("element topilmasa — 404", async () => {
    mockFound(planDoc({ item: null }));

    await expect(
      service.verifyActivity(
        PLAN_ID, ACT_ID,
        userWithRole(ROLES.KAFEDRA_MUDIRI),
        SCOPE,
        { section: "researchWork", decision: "approved" },
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test("reja scope tashqarisida bo'lsa — 404 (findScoped)", async () => {
    mockFound(null);

    await expect(
      service.verifyActivity(
        PLAN_ID, ACT_ID,
        userWithRole(ROLES.KAFEDRA_MUDIRI),
        SCOPE,
        { section: "researchWork", decision: "approved" },
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("completedItemsPipeline — scope threading va shakl (DB'siz)", () => {
  test("faqat `status:\"completed\"` elementlar (bo'lim filtri bosqichi bor)", () => {
    const pipeline = service.completedItemsPipeline(SCOPE, {});
    const hasCompletedMatch = pipeline.some(
      (stage) => stage.$match && stage.$match["items.status"] === "completed",
    );
    expect(hasCompletedMatch).toBe(true);
  });

  test("kafedra_mudiri scope ($in) — birinchi $match'da o'tadi", () => {
    const pipeline = service.completedItemsPipeline(SCOPE, {});
    expect(pipeline[0].$match.teacher).toEqual(SCOPE.teacher);
  });

  test("ilmiy_bolim bypass scope (`{}`) — cheklovsiz $match", () => {
    const pipeline = service.completedItemsPipeline({}, {});
    expect(pipeline[0].$match.teacher).toBeUndefined();
    expect(pipeline[0].$match.active).toBe(true);
  });

  test("`section` filtri berilsa — faqat shu bo'lim $concatArrays ga kiradi", () => {
    const withFilter = service.completedItemsPipeline(SCOPE, { section: "researchWork" });
    const projectStage = withFilter.find((s) => s.$project && s.$project.items);
    expect(projectStage.$project.items.$concatArrays).toHaveLength(1);

    const withoutFilter = service.completedItemsPipeline(SCOPE, {});
    const projectAll = withoutFilter.find((s) => s.$project && s.$project.items);
    expect(projectAll.$project.items.$concatArrays).toHaveLength(EDITABLE_SECTIONS.length);
  });

  test("javob proyeksiyasida planId/section/itemId/title bor", () => {
    const pipeline = service.completedItemsPipeline(SCOPE, {});
    const finalProject = pipeline[pipeline.length - 1].$project;
    expect(finalProject).toMatchObject({
      planId: "$_id",
      section: "$items.section",
      itemId: "$items._id",
      title: "$items.title",
    });
  });

  test("`verificationStatus` filtri qo'shilganda alohida $match bosqichi bo'ladi", () => {
    const pipeline = service.completedItemsPipeline(SCOPE, { verificationStatus: "rejected" });
    const hasVerificationMatch = pipeline.some(
      (stage) => stage.$match && stage.$match["items.verification.status"] === "rejected",
    );
    expect(hasVerificationMatch).toBe(true);
  });
});

describe("REGRESSION-GUARD — controller/service `findById` ishlatmasin", () => {
  test("verifyActivity `findOne({_id, ...scope})` bilan ishlaydi (IDOR himoyasi)", async () => {
    const item = { _id: ACT_ID, status: "completed", verification: { status: "pending" } };
    mockFound(planDoc({ item }));

    await service.verifyActivity(
      PLAN_ID, ACT_ID,
      userWithRole(ROLES.KAFEDRA_MUDIRI),
      SCOPE,
      { section: "researchWork", decision: "approved" },
    );

    expect(PersonalWorkPlanModel.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: PLAN_ID, teacher: SCOPE.teacher }),
    );
  });
});
