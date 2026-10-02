jest.mock("./workloadDistribution.model");
jest.mock("#references/auditoriumHour/auditoriumHour.model", () => ({
  findOne: jest.fn(),
}));

const WorkloadDistribution = require("./workloadDistribution.model");
const AuditoriumHour = require("#references/auditoriumHour/auditoriumHour.model");
const {
  clearNormaCache,
} = require("#modules/4.02-studyLoad/_services/workloadValidator");
const Controller = require("./workloadDistribution.controller");

const NORMA = {
  auditoriumHour: 880,
  categories: [
    { slug: "assistant", value: 400 },
    { slug: "docent", value: 350 },
  ],
  allowedStakes: [0.5, 1.0],
};

const block = (aud, total, nonAudit = 0) => ({
  studyWork: {
    thisSemester: { auditoriumHour: aud, totalHour: total - nonAudit },
  },
  nonAuditHour: nonAudit,
  totalHour: total,
});

const docWith = (teachers) => ({
  toObject: () => ({ _id: "d1", teachers }),
});

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const callDetail = async (doc) => {
  WorkloadDistribution.findOne = jest.fn().mockReturnValue({
    populate: () => ({ exec: () => Promise.resolve(doc) }),
  });
  const res = createRes();
  const next = jest.fn();
  await Controller.findOneWorkloadDistribution(
    { params: { id: "d1" }, scope: {}, query: {} },
    res,
    next,
  );
  return { res, next, body: res.json.mock.calls[0]?.[0] };
};

beforeEach(() => {
  clearNormaCache();
  AuditoriumHour.findOne.mockReturnValue({
    sort: () => ({ lean: () => Promise.resolve(NORMA) }),
  });
});

afterEach(() => {
  clearNormaCache();
  jest.clearAllMocks();
});

describe("workloadDistribution — detail javobi seam (D-129 / ADR-013)", () => {
  test("vakant BO'LMAGAN yozuv: minHour + maxHour + auditoriumHour qaytadi", async () => {
    const { res, body } = await callDetail(
      docWith([
        {
          _id: "t1",
          position: "assistant",
          stavka: 1.0,
          totalHour: 400,
          blocks: [block(300, 400, 40)],
        },
      ]),
    );

    expect(res.status).toHaveBeenCalledWith(200);
    const t = body.teachers[0];
    expect(t.minHour).toBe(400);
    expect(t.maxHour).toBe(600);
    expect(t.auditoriumHour).toBe(300);
    expect(t.totalHour).toBe(400);
  });

  test("bir nechta blok — auditoriya bloklar bo'yicha yig'iladi", async () => {
    const { body } = await callDetail(
      docWith([
        {
          _id: "t2",
          position: "docent",
          stavka: 1.0,
          totalHour: 700,
          blocks: [block(200, 300, 20), block(150, 400, 50)],
        },
      ]),
    );
    expect(body.teachers[0].auditoriumHour).toBe(350);
    expect(body.teachers[0].minHour).toBe(350);
  });

  test("VAKANT yozuv: auditoriumHour bor, minHour/maxHour YO'Q (norma tekshirilmaydi)", async () => {
    const { body } = await callDetail(
      docWith([{ _id: "t3", isVacant: true, blocks: [block(120, 150, 10)] }]),
    );
    const t = body.teachers[0];
    expect(t.auditoriumHour).toBe(120);
    expect(t.minHour).toBeUndefined();
    expect(t.maxHour).toBeUndefined();
  });

  test("bloksiz yozuv → auditoriumHour = 0 (undefined EMAS — UI NaN ko'rsatmasin)", async () => {
    const { body } = await callDetail(
      docWith([{ _id: "t4", position: "assistant", stavka: 1.0 }]),
    );
    expect(body.teachers[0].auditoriumHour).toBe(0);
  });

  test("ADR-006 allowedStakes seam buzilmadi", async () => {
    const { body } = await callDetail(docWith([]));
    expect(body.allowedStakes).toEqual([0.5, 1.0]);
  });
});

describe("workloadDistribution — detail populate (Faza 2 §D.1)", () => {
  test("teachers.blocks.justification.declaredBy populate ro'yxatida bor", async () => {
    const populateSpy = jest.fn().mockReturnValue({
      exec: () => Promise.resolve(docWith([])),
    });
    WorkloadDistribution.findOne = jest
      .fn()
      .mockReturnValue({ populate: populateSpy });

    const res = createRes();
    await Controller.findOneWorkloadDistribution(
      { params: { id: "d1" }, scope: {}, query: {} },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(200);
    const specs = populateSpy.mock.calls[0][0];
    const declaredBySpec = specs.find(
      (s) => s.path === "teachers.blocks.justification.declaredBy",
    );
    expect(declaredBySpec).toBeDefined();
    expect(declaredBySpec.select).toBe("firstName lastName");
    expect(declaredBySpec.strictPopulate).toBe(false);

    expect(specs.some((s) => s.path === "teachers.teacher")).toBe(true);
    expect(specs.some((s) => s.path === "teachers.blocks.science")).toBe(true);
  });
});
