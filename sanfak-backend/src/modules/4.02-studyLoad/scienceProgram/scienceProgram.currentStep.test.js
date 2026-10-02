const ScienceProgram = require("./scienceProgram.model");
const Controller = require("./scienceProgram.controller");

const STEPS = [
  "teacher",
  "kafedra",
  "arm",
  "methodical",
  "prorektor",
  "rektor",
];

const buildSteps = (pendingFrom) =>
  STEPS.map((step) => ({
    step,
    status:
      pendingFrom === null || STEPS.indexOf(step) < STEPS.indexOf(pendingFrom)
        ? "approved"
        : "pending",
    eriSignature: "SIR-BASE64-PKCS7",
  }));

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const runPaginate = async (docs) => {
  const spy = jest
    .spyOn(ScienceProgram, "paginate")
    .mockResolvedValue({ docs, totalDocs: docs.length, page: 1, limit: 20 });
  const res = createRes();
  await Controller.paginateSciencePrograms(
    { query: { page: 1, limit: 20 }, scope: {} },
    res,
    jest.fn(),
  );
  return { body: JSON.parse(JSON.stringify(res.json.mock.calls[0][0])), spy };
};

afterEach(() => jest.restoreAllMocks());

describe("scienceProgram — /paginate javobida `currentStep`", () => {
  test("pending bosqich bor — `currentStep` o'sha bosqich slug'i bo'ladi", async () => {
    const { body } = await runPaginate([
      { _id: "p1", status: "in_review", approvalSteps: buildSteps("arm") },
    ]);

    expect(body.docs[0].currentStep).toBe("arm");
  });

  test("oxirgi bosqich navbatda — `currentStep` = 'rektor'", async () => {
    const { body } = await runPaginate([
      { _id: "p1", status: "in_review", approvalSteps: buildSteps("rektor") },
    ]);

    expect(body.docs[0].currentStep).toBe("rektor");
  });

  test("hamma bosqich approved — `currentStep` null", async () => {
    const { body } = await runPaginate([
      { _id: "p1", status: "approved", approvalSteps: buildSteps(null) },
    ]);

    expect(body.docs[0].currentStep).toBeNull();
  });

  test("`approvalSteps` yo'q yoki null — null qaytadi, xato bermaydi", async () => {
    const { body } = await runPaginate([
      { _id: "p1", status: "draft" },
      { _id: "p2", status: "draft", approvalSteps: null },
    ]);

    expect(body.docs[0].currentStep).toBeNull();
    expect(body.docs[1].currentStep).toBeNull();
  });

  test("xom `approvalSteps` javobga CHIQMAYDI (eriSignature sizib ketmasin)", async () => {
    const { body } = await runPaginate([
      { _id: "p1", status: "in_review", approvalSteps: buildSteps("kafedra") },
    ]);

    expect(body.docs[0]).not.toHaveProperty("approvalSteps");
    expect(JSON.stringify(body)).not.toContain("eriSignature");
  });

  test("`select` da `approvalSteps` bor — aks holda `currentStep` doim null bo'lardi", async () => {
    const { spy } = await runPaginate([{ _id: "p1", status: "draft" }]);

    expect(spy.mock.calls[0][1].select).toContain("approvalSteps");
  });
});
