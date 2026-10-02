jest.mock("#shared/error", () => ({
  ErrorHandler: class ErrorHandler extends Error {
    constructor(status, message, detail) {
      super(message);
      this.status = status;
      this.detail = detail;
    }
  },
}));
jest.mock("./scholarshipApplication.model", () => ({ paginate: jest.fn() }));
jest.mock("#modules/4.11-giftedStudent/giftedStudent/giftedStudent.model", () => ({
  findOne: jest.fn(),
}));
jest.mock("#modules/4.11-giftedStudent/scholarship/scholarship.model", () => ({}));
jest.mock("#system/notification/notification.service", () => ({
  notify: jest.fn(),
  templates: { scholarshipResult: jest.fn(() => "") },
}));
jest.mock("../_services/studentAccess", () => ({
  denyStudentAccess: jest.fn(),
  resolveOwnedGiftedStudentIds: jest.fn(async () => null),
}));

const FAC = "69df7a8f94bda50c83a1d435";
const DIR = "69df7a8f94bda50c83a1d4a1";
const GRP = "69df7a8f94bda50c83a1d4a7";
let mockRows = { faculty: [], direction: [], group: [] };
const refModel = (kind) => ({
  find: (q) => {
    const ids = (q._id.$in || []).map(String);
    return {
      select: () => ({
        lean: async () => mockRows[kind].filter((r) => ids.includes(String(r._id))),
      }),
    };
  },
});
jest.mock("#references/faculty/faculty.model", () => refModel("faculty"));
jest.mock("#references/direction/direction.model", () => refModel("direction"));
jest.mock("#references/group/group.model", () => refModel("group"));

const Controller = require("./scholarshipApplication.controller");
const ScholarshipApplication = require("./scholarshipApplication.model");

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

const REF_FIELDS = ["facultyId", "directionId", "groupId"];
const admin = { _id: "x", role: { title: "super_admin" } };
const callFindAll = (res) => Controller.findAll({ user: admin, query: {} }, res, jest.fn());

const staleApplication = () => ({
  _id: "app1",
  scholarshipName: "ESKI stipendiya nomi",
  giftedStudent: {
    _id: "gs1",
    fullName: "Aliyev Sardor",
    faculty: "ESKI fakultet nomi",
    facultyId: FAC,
    direction: "ESKI yo'nalish nomi",
    directionId: DIR,
    group: "ESKI guruh nomi",
    groupId: GRP,
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRows = {
    faculty: [{ _id: FAC, title: "Farmatsiya fakulteti (JORIY)" }],
    direction: [{ _id: DIR, title: "Farmatsiya ishi (JORIY)" }],
    group: [{ _id: GRP, title: "Farm-101 (JORIY)" }],
  };
  ScholarshipApplication.paginate.mockResolvedValue({ totalDocs: 0, docs: [] });
});

const optionsOf = () => ScholarshipApplication.paginate.mock.calls[0][1];
const popOf = (path) => optionsOf().populate.find((p) => p.path === path);

describe("findAll — paginate opsiyalari", () => {
  test("`lean: true` — usiz refresh mongoose hujjatida jimgina ishlamasdi", async () => {
    await callFindAll(mockRes());
    expect(optionsOf().lean).toBe(true);
  });

  test("`giftedStudent` select'i EXCLUSION — ref ID lari olib tashlanmaydi", async () => {
    await callFindAll(mockRes());
    const select = popOf("giftedStudent").select;
    select.split(/\s+/).filter(Boolean).forEach((t) => expect(t.startsWith("-")).toBe(true));
    REF_FIELDS.forEach((f) => expect(select).not.toContain(f));
  });

  test("`scholarship` ham populate qilinadi (nom snapshotdan emas, katalogdan)", async () => {
    await callFindAll(mockRes());
    expect(popOf("scholarship")).toEqual({ path: "scholarship", select: "name type" });
  });

  test("mavjud populate'lar saqlanadi — regressiya yo'q", async () => {
    await callFindAll(mockRes());
    expect(popOf("giftedStudent").populate).toEqual({
      path: "user",
      select: "firstName lastName",
    });
    expect(popOf("reviewedBy")).toEqual({ path: "reviewedBy", select: "firstName lastName" });
  });
});

describe("findAll — ma'lumotnoma nomi snapshot ustidan g'olib", () => {
  test("qayta nomlangan fakultet/yo'nalish/guruh javobda JORIY nom bilan", async () => {
    ScholarshipApplication.paginate.mockResolvedValue({
      totalDocs: 1,
      docs: [staleApplication()],
    });
    const res = mockRes();
    await callFindAll(res);

    const [payload] = res.json.mock.calls[0];
    expect(payload.docs[0].giftedStudent.faculty).toBe("Farmatsiya fakulteti (JORIY)");
    expect(payload.docs[0].giftedStudent.direction).toBe("Farmatsiya ishi (JORIY)");
    expect(payload.docs[0].giftedStudent.group).toBe("Farm-101 (JORIY)");
  });

  test("ID lar TEGILMAYDI — javob shakli o'zgarmaydi", async () => {
    ScholarshipApplication.paginate.mockResolvedValue({
      totalDocs: 1,
      docs: [staleApplication()],
    });
    const res = mockRes();
    await callFindAll(res);

    expect(res.json.mock.calls[0][0].docs[0].giftedStudent.facultyId).toBe(FAC);
  });

  test("`giftedStudent` populate `null` (yozuv o'chirilgan) — yiqilmaydi", async () => {
    ScholarshipApplication.paginate.mockResolvedValue({
      totalDocs: 1,
      docs: [{ _id: "app2", giftedStudent: null }],
    });
    const res = mockRes();
    await callFindAll(res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("`docs` bo'lmagan javob shakli ham yiqitmaydi", async () => {
    ScholarshipApplication.paginate.mockResolvedValue({ totalDocs: 0 });
    const res = mockRes();
    await callFindAll(res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
