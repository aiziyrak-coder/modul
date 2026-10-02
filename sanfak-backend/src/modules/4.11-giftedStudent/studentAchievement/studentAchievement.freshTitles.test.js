jest.mock("#shared/error", () => ({
  ErrorHandler: class ErrorHandler extends Error {
    constructor(status, message, detail) {
      super(message);
      this.status = status;
      this.detail = detail;
    }
  },
}));
jest.mock("#system/notification/notification.service", () => ({ notify: jest.fn() }));
jest.mock("../_services/studentAccess", () => ({
  denyStudentAccess: jest.fn(async () => false),
  resolveOwnedGiftedStudentIds: jest.fn(async () => null),
}));
jest.mock("../_services/moduleRoles", () => ({ isAchievementReviewer: jest.fn(() => true) }));
jest.mock("#modules/4.11-giftedStudent/giftedStudent/giftedStudent.model", () => ({
  findOne: jest.fn(async () => ({ _id: "gs1" })),
  findByIdAndUpdate: jest.fn(),
}));
jest.mock("#modules/4.11-giftedStudent/documentType/documentType.model", () => ({
  find: jest.fn(() => ({ distinct: jest.fn(async () => []) })),
}));
jest.mock("./studentAchievement.model", () => ({ find: jest.fn() }));

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

const Controller = require("./studentAchievement.controller");
const StudentAchievement = require("./studentAchievement.model");

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
    populate: jest.fn((arg) => {
      chain.populateArgs.push(arg);
      return chain;
    }),
    sort: jest.fn(() => chain),
    lean: jest.fn(() => {
      chain.leanCalls += 1;
      return chain;
    }),
    exec: jest.fn(async () => docs),
  };
  StudentAchievement.find.mockReturnValue(chain);
  return chain;
}

const staleDoc = () => ({
  _id: "a1",
  title: "Xalqaro olimpiada",
  student: {
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
});

describe.each([
  ["findAllAchievements", (res) => Controller.findAllAchievements({ user: { _id: "u1", role: { title: "iqtidorli_bolim" } }, query: {} }, res, jest.fn())],
  ["findAchievementsByStudent", (res) => Controller.findAchievementsByStudent({ user: { _id: "u1", role: { title: "iqtidorli_bolim" } }, params: { studentId: "gs1" }, query: {} }, res, jest.fn())],
])("%s — snapshot ustiga ma'lumotnoma nomi", (_name, call) => {
  test("populate select'ida ref ID lari BOR (usiz refresh ham, mijoz ham nochor)", async () => {
    const chain = mockFindChain([]);
    await call(mockRes());

    const studentPop = chain.populateArgs.find((a) => a && a.path === "student");
    expect(studentPop).toBeDefined();
    REF_FIELDS.forEach((f) => expect(studentPop.select.split(/\s+/)).toContain(f));
  });

  test("so'rov `.lean()` — `applyFreshTitles` faqat plain obyektni o'zgartiradi", async () => {
    const chain = mockFindChain([]);
    await call(mockRes());
    expect(chain.leanCalls).toBe(1);
  });

  test("ma'lumotnomada qayta nomlangan qator ESKI snapshot ustidan g'olib", async () => {
    mockFindChain([staleDoc()]);
    const res = mockRes();
    await call(res);

    const [payload] = res.json.mock.calls[0];
    expect(payload[0].student.faculty).toBe("Farmatsiya fakulteti (JORIY)");
    expect(payload[0].student.direction).toBe("Farmatsiya ishi (JORIY)");
    expect(payload[0].student.group).toBe("Farm-101 (JORIY)");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("ID lar javobda SAQLANADI — mijoz filtri ular bo'yicha ishlaydi", async () => {
    mockFindChain([staleDoc()]);
    const res = mockRes();
    await call(res);

    const [payload] = res.json.mock.calls[0];
    expect(payload[0].student.facultyId).toBe(FAC);
    expect(payload[0].student.groupId).toBe(GRP);
  });

  test("ma'lumotnomada qator yo'q — snapshot o'z holicha, javob yiqilmaydi", async () => {
    mockRows.faculty = [];
    mockFindChain([staleDoc()]);
    const res = mockRes();
    await call(res);

    const [payload] = res.json.mock.calls[0];
    expect(payload[0].student.faculty).toBe("ESKI fakultet nomi");
    expect(payload[0].student.facultyId).toBe(FAC);
  });

  test("`student` populate `null` — yiqilmaydi", async () => {
    mockFindChain([{ _id: "a2", student: null }]);
    const res = mockRes();
    await call(res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("findMyAchievements — `student` populate QILMAYDI, refresh KERAK EMAS", () => {
  test("faqat `documentType` populate qilinadi (talaba o'z profilini boshqa yo'ldan oladi)", async () => {
    const chain = mockFindChain([]);
    await Controller.findMyAchievements({ user: { _id: "u1" } }, mockRes(), jest.fn());

    expect(chain.populateArgs).toEqual(["documentType"]);
    expect(chain.populateArgs.some((a) => a && a.path === "student")).toBe(false);
  });
});
