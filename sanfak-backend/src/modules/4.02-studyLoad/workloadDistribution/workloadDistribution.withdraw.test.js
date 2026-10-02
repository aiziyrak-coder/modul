jest.mock("./workloadDistribution.model");

const WorkloadDistribution = require("./workloadDistribution.model");
const Controller = require("./workloadDistribution.controller");
const { ROLES } = require("#config/constants");

const DIST_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const steps = (approvedIdx = -1) =>
  ["kafedra", "methodical", "financial", "dean", "prorektor"].map((s, i) => ({
    step: s,
    label: s === "kafedra" ? "Kafedra mudiri" : s,
    status: i === approvedIdx ? "approved" : "pending",
    approvedBy: null,
    date: null,
    comment: null,
    signature: null,
    eriSignature: null,
    eriSerial: null,
    eriSignedAt: null,
  }));

const distDoc = (over = {}) => ({
  _id: DIST_ID,
  status: "in_review",
  file: "taqsimot.pdf",
  approvalSteps: steps(),
  save: jest.fn().mockResolvedValue(undefined),
  ...over,
});

const call = async (doc, { role = ROLES.KAFEDRA_MUDIRI, scope = {} } = {}) => {
  WorkloadDistribution.findOne = jest.fn().mockResolvedValue(doc);
  const res = createRes();
  const next = jest.fn();
  await Controller.withdraw(
    { params: { id: DIST_ID }, user: { _id: "u1", role: { title: role } }, scope },
    res,
    next,
  );
  return { res, next };
};

const errOf = (next) => next.mock.calls[0]?.[0];

describe("workloadDistribution.withdraw", () => {
  afterEach(() => jest.resetAllMocks());

  test("in_review + hech kim tasdiqlamagan → draft ga qaytadi", async () => {
    const doc = distDoc();
    const { res, next } = await call(doc);

    expect(next).not.toHaveBeenCalled();
    expect(doc.status).toBe("draft");
    expect(doc.file).toBeNull();
    expect(doc.save).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].action).toBe("withdrawn");
  });

  test("faqat KAFEDRA imzolagan (submit avtomatik) → qaytarib olinadi", async () => {
    const doc = distDoc({ approvalSteps: steps(0) });
    const { res, next } = await call(doc);

    expect(next).not.toHaveBeenCalled();
    expect(doc.status).toBe("draft");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("QUYI OQIM bosqichi tasdiqlagan bo'lsa → 400, hujjat TEGILMAYDI", async () => {
    const doc = distDoc({ approvalSteps: steps(1) });
    const { next } = await call(doc);

    const err = errOf(next);
    expect(err.statusCode).toBe(400);
    expect(err.message).toContain("methodical");
    expect(doc.status).toBe("in_review");
    expect(doc.save).not.toHaveBeenCalled();
  });

  test.each(["draft", "approved", "rejected"])(
    "%s holatida → 400 (faqat in_review qaytarib olinadi)",
    async (status) => {
      const doc = distDoc({ status });
      const { next } = await call(doc);

      expect(errOf(next).statusCode).toBe(400);
      expect(doc.save).not.toHaveBeenCalled();
    },
  );

  test("kafedra mudiri emas → 403", async () => {
    const doc = distDoc();
    const { next } = await call(doc, { role: ROLES.DEKAN });

    expect(errOf(next).statusCode).toBe(403);
    expect(doc.save).not.toHaveBeenCalled();
  });

  test("super_admin ham qaytarib ola oladi", async () => {
    const doc = distDoc();
    const { next } = await call(doc, { role: ROLES.SUPER_ADMIN });

    expect(next).not.toHaveBeenCalled();
    expect(doc.status).toBe("draft");
  });

  test("qidiruv `req.scope` bilan cheklanadi — begona kafedra 404", async () => {
    WorkloadDistribution.findOne = jest.fn().mockResolvedValue(null);
    const next = jest.fn();
    await Controller.withdraw(
      {
        params: { id: DIST_ID },
        user: { _id: "u1", role: { title: ROLES.KAFEDRA_MUDIRI } },
        scope: { department: { $in: ["dep-1"] } },
      },
      createRes(),
      next,
    );

    expect(WorkloadDistribution.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ department: { $in: ["dep-1"] } }),
    );
    expect(errOf(next).statusCode).toBe(404);
  });
});
