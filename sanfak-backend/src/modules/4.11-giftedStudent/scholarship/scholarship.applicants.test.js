jest.mock("#shared/error", () => ({
  ErrorHandler: class ErrorHandler extends Error {
    constructor(status, message, detail) {
      super(message);
      this.status = status;
      this.detail = detail;
    }
  },
}));
jest.mock("./scholarship.model", () => ({}));
jest.mock("#modules/4.11-giftedStudent/scholarshipApplication/scholarshipApplication.model", () => ({
  find: jest.fn(),
}));
jest.mock("../_services/scoringComplete", () => ({
  isScoringComplete: jest.fn(),
  touchesScoring: jest.fn(),
}));
jest.mock("../_services/roleEligibility", () => ({ rolesGranting: jest.fn() }));
jest.mock("../_services/userCandidates", () => ({ usersWithRoles: jest.fn() }));

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

const Controller = require("./scholarship.controller");
const ScholarshipApplication = require("#modules/4.11-giftedStudent/scholarshipApplication/scholarshipApplication.model");

const REF_FIELDS = ["facultyId", "directionId", "groupId"];

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

function mockFindChain(docs = []) {
  const chain = {
    populateArgs: [],
    leanCalls: 0,
    select: jest.fn(() => chain),
    populate: jest.fn((arg) => {
      chain.populateArgs.push(arg);
      return chain;
    }),
    sort: jest.fn(() => chain),
    lean: jest.fn(async () => {
      chain.leanCalls += 1;
      return docs;
    }),
  };
  ScholarshipApplication.find.mockReturnValue(chain);
  return chain;
}

const staleRow = () => ({
  _id: "app1",
  appliedAt: new Date("2026-01-05T00:00:00Z"),
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

const call = (res) => Controller.findApplicants({ params: { id: "sch1" } }, res, jest.fn());

beforeEach(() => {
  jest.clearAllMocks();
  mockRows = {
    faculty: [{ _id: FAC, title: "Farmatsiya fakulteti (JORIY)" }],
    direction: [{ _id: DIR, title: "Farmatsiya ishi (JORIY)" }],
    group: [{ _id: GRP, title: "Farm-101 (JORIY)" }],
  };
});

describe("findApplicants — populate shartnomasi", () => {
  test("select'da ref ID lari BOR", async () => {
    const chain = mockFindChain([]);
    await call(mockRes());

    const pop = chain.populateArgs.find((a) => a && a.path === "giftedStudent");
    expect(pop).toBeDefined();
    REF_FIELDS.forEach((f) => expect(pop.select.split(/\s+/)).toContain(f));
  });

  test("PII qo'shilmagan: pasport/JSHSHIR/kontakt select'da YO'Q", async () => {
    const chain = mockFindChain([]);
    await call(mockRes());

    const { select } = chain.populateArgs.find((a) => a && a.path === "giftedStudent");
    ["passportSeria", "passportNumber", "jshshir", "email", "phone"].forEach((f) =>
      expect(select).not.toContain(f),
    );
  });

  test("so'rov `.lean()` bilan tugaydi", async () => {
    const chain = mockFindChain([]);
    await call(mockRes());
    expect(chain.leanCalls).toBe(1);
  });
});

describe("findApplicants — ma'lumotnoma nomi snapshot ustidan g'olib", () => {
  test("qayta nomlangan fakultet/yo'nalish/guruh javobda JORIY nom bilan", async () => {
    mockFindChain([staleRow()]);
    const res = mockRes();
    await call(res);

    const [applicants] = res.json.mock.calls[0];
    expect(applicants[0].faculty).toBe("Farmatsiya fakulteti (JORIY)");
    expect(applicants[0].direction).toBe("Farmatsiya ishi (JORIY)");
    expect(applicants[0].group).toBe("Farm-101 (JORIY)");
  });

  test("`appliedAt` va ID lar saqlanadi — javob shakli o'zgarmaydi", async () => {
    mockFindChain([staleRow()]);
    const res = mockRes();
    await call(res);

    const [applicants] = res.json.mock.calls[0];
    expect(applicants[0].appliedAt).toEqual(new Date("2026-01-05T00:00:00Z"));
    expect(applicants[0].facultyId).toBe(FAC);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("`giftedStudent` yo'q qator ro'yxatdan tushadi (avvalgi xulq)", async () => {
    mockFindChain([{ _id: "app2", giftedStudent: null }, staleRow()]);
    const res = mockRes();
    await call(res);

    expect(res.json.mock.calls[0][0]).toHaveLength(1);
  });
});
