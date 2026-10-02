const Syllabus = require("./syllabus.model");
const Controller = require("./syllabus.controller");

const STEPS = ["kafedra", "arm", "methodical", "prorektor"];

const buildSteps = (pendingFrom) =>
  STEPS.map((step) => ({
    step,
    status:
      pendingFrom === null || STEPS.indexOf(step) < STEPS.indexOf(pendingFrom)
        ? "approved"
        : "pending",
    comment: step === "kafedra" ? "kafedra izohi" : null,
  }));

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const runPaginate = async (docs) => {
  jest
    .spyOn(Syllabus, "paginate")
    .mockResolvedValue({ docs, totalDocs: docs.length, page: 1, limit: 20 });
  const res = createRes();
  await Controller.paginateSyllabuses(
    { query: { page: 1, limit: 20 }, scope: {} },
    res,
    jest.fn(),
  );
  return JSON.parse(JSON.stringify(res.json.mock.calls[0][0]));
};

afterEach(() => jest.restoreAllMocks());

describe("syllabus — /paginate javobida `currentStep`", () => {
  test("pending bosqich bor — `currentStep` o'sha bosqich slug'i bo'ladi", async () => {
    const body = await runPaginate([
      { _id: "s1", status: "in_review", approvalSteps: buildSteps("methodical") },
    ]);

    expect(body.docs[0].currentStep).toBe("methodical");
  });

  test("birinchi bosqich navbatda — `currentStep` = 'kafedra'", async () => {
    const body = await runPaginate([
      { _id: "s1", status: "in_review", approvalSteps: buildSteps("kafedra") },
    ]);

    expect(body.docs[0].currentStep).toBe("kafedra");
  });

  test("hamma bosqich approved — `currentStep` null", async () => {
    const body = await runPaginate([
      { _id: "s1", status: "approved", approvalSteps: buildSteps(null) },
    ]);

    expect(body.docs[0].currentStep).toBeNull();
  });

  test("`approvalSteps` yo'q yoki null — null qaytadi, xato bermaydi", async () => {
    const body = await runPaginate([
      { _id: "s1", status: "draft" },
      { _id: "s2", status: "draft", approvalSteps: null },
    ]);

    expect(body.docs[0].currentStep).toBeNull();
    expect(body.docs[1].currentStep).toBeNull();
  });

  test("xom `approvalSteps` javobda QOLADI — FE rad-sabab tooltipi shundan o'qiydi", async () => {
    const body = await runPaginate([
      { _id: "s1", status: "in_review", approvalSteps: buildSteps("arm") },
    ]);

    expect(Array.isArray(body.docs[0].approvalSteps)).toBe(true);
    expect(body.docs[0].approvalSteps[0].comment).toBe("kafedra izohi");
  });

  test("sahifalash meta maydonlari o'zgarmaydi", async () => {
    const body = await runPaginate([
      { _id: "s1", status: "in_review", approvalSteps: buildSteps("arm") },
    ]);

    expect(body.totalDocs).toBe(1);
    expect(body.page).toBe(1);
  });
});
