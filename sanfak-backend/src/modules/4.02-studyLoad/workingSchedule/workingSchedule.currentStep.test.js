jest.mock("#references/_services/educationActivityResolver", () => ({
  populateAllSlugRefs: jest.fn().mockResolvedValue(undefined),
}));

const mongoose = require("mongoose");
const WorkingScheduleModel = require("./workingSchedule.model");
const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
const Controller = require("./workingSchedule.controller");

const STEPS = ["methodical", "dean", "prorektor", "rektor"];

const buildHistory = (pendingFrom) =>
  STEPS.map((step) => ({
    step,
    status:
      pendingFrom === null || STEPS.indexOf(step) < STEPS.indexOf(pendingFrom)
        ? "approved"
        : "pending",
    eriSignature: "SIR-BASE64-PKCS7",
  }));

const hydrate = (fields) =>
  WorkingScheduleModel.hydrate({
    _id: new mongoose.Types.ObjectId(),
    title: "Test ishchi reja",
    status: "in_review",
    learningProcess: new mongoose.Types.ObjectId(),
    ...fields,
  });

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const runPaginate = async (docs) => {
  const spy = jest
    .spyOn(WorkingScheduleModel, "paginate")
    .mockResolvedValue({ docs, totalDocs: docs.length, page: 1, limit: 20 });
  jest
    .spyOn(StudyPlanModel, "find")
    .mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
  const res = createRes();
  await Controller.paginate(
    { query: { page: 1, limit: 20 }, scope: {} },
    res,
    (err) => {
      throw err;
    },
  );
  return { body: JSON.parse(JSON.stringify(res.json.mock.calls[0][0])), spy };
};

afterEach(() => jest.restoreAllMocks());

describe("workingSchedule — /paginate javobida `currentStep`", () => {
  test("lean BO'LMAGAN Mongoose hujjatida ham `currentStep` javobga yetib boradi", async () => {
    const doc = hydrate({ approvalHistory: buildHistory("dean") });
    expect(doc).toBeInstanceOf(mongoose.Document);

    const { body } = await runPaginate([doc]);

    expect(body.docs[0].currentStep).toBe("dean");
  });

  test("birinchi bosqich navbatda — `currentStep` = 'methodical'", async () => {
    const { body } = await runPaginate([
      hydrate({ approvalHistory: buildHistory("methodical") }),
    ]);

    expect(body.docs[0].currentStep).toBe("methodical");
  });

  test("hamma bosqich approved — `currentStep` null", async () => {
    const { body } = await runPaginate([
      hydrate({ status: "approved", approvalHistory: buildHistory(null) }),
    ]);

    expect(body.docs[0].currentStep).toBeNull();
  });

  test("`approvalHistory` bo'sh — null qaytadi, xato bermaydi", async () => {
    const { body } = await runPaginate([hydrate({ approvalHistory: [] })]);

    expect(body.docs[0].currentStep).toBeNull();
  });

  test("xom `approvalHistory` javobga CHIQMAYDI (eriSignature sizib ketmasin)", async () => {
    const { body } = await runPaginate([
      hydrate({ approvalHistory: buildHistory("rektor") }),
    ]);

    expect(body.docs[0]).not.toHaveProperty("approvalHistory");
    expect(JSON.stringify(body)).not.toContain("eriSignature");
  });

  test("`select` da `approvalHistory` bor — `approvalSteps` EMAS (jim buziladigan tuzoq)", async () => {
    const { spy } = await runPaginate([hydrate({ approvalHistory: [] })]);

    const { select } = spy.mock.calls[0][1];
    expect(select).toContain("approvalHistory");
    expect(select).not.toContain("approvalSteps");
  });

  test("mavjud post-processing buzilmadi — `file` va sahifalash meta joyida", async () => {
    const { body } = await runPaginate([
      hydrate({ approvalHistory: buildHistory("dean") }),
    ]);

    expect(body.docs[0]).toHaveProperty("file", null);
    expect(body.docs[0].title).toBe("Test ishchi reja");
    expect(body.totalDocs).toBe(1);
  });
});
