jest.mock("./workloadDistribution.model");
jest.mock("#modules/4.02-studyLoad/workload/workload.model");

const Workload = require("#modules/4.02-studyLoad/workload/workload.model");
const WorkloadDistribution = require("./workloadDistribution.model");
const Controller = require("./workloadDistribution.controller");
const { ROLES } = require("#config/constants");

const WORKLOAD_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createReq = () => ({
  body: { workload: WORKLOAD_ID, date: "2026-08-13" },
  query: {},
  params: {},
  scope: {},
  user: {
    _id: "507f1f77bcf86cd799439011",
    role: { title: ROLES.KAFEDRA_MUDIRI },
  },
});

const runCreate = async (status) => {
  Workload.findById = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue({
      _id: WORKLOAD_ID,
      status,
      department: "dddddddddddddddddddddddd",
      academicYear: "bbbbbbbbbbbbbbbbbbbbbbbb",
      directions: [],
    }),
  });
  WorkloadDistribution.findOne = jest.fn().mockResolvedValue(null);

  const next = jest.fn();
  const res = createRes();
  await Controller.addWorkloadDistribution(createReq(), res, next);
  return { next, res };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Taqsimot yaratish — yuklama holati qulfi", () => {
  test.each([
    ["rejected", "RAD ETILGAN — aynan jonli QA'da topilgan holat"],
    ["draft", "hali yuborilmagan"],
    ["new", "yangi"],
    ["in_review", "zanjirda turgan (hali tasdiqlanmagan)"],
  ])("`%s` yuklama uchun taqsimot YARATILMAYDI (400) — %s", async (status) => {
    const { next, res } = await runCreate(status);

    expect(next).toHaveBeenCalled();
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(400);
    expect(String(err.message)).toMatch(/TASDIQLANGAN/i);
    expect(WorkloadDistribution.create).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(201);
  });

  test("`approved` yuklama guarddan O'TADI (dublikat tekshiruvigacha yetadi)", async () => {
    const { next } = await runCreate("approved");

    const guardError = next.mock.calls.find(
      (c) => c[0]?.statusCode === 400 && /TASDIQLANGAN/i.test(String(c[0]?.message)),
    );
    expect(guardError).toBeUndefined();
    expect(WorkloadDistribution.findOne).toHaveBeenCalledWith(
      { workload: WORKLOAD_ID },
      { _id: 1 },
    );
  });

  test("Guard dublikat tekshiruvidan OLDIN ishlaydi (tartib muhim)", async () => {
    await runCreate("rejected");
    expect(WorkloadDistribution.findOne).not.toHaveBeenCalled();
  });
});
