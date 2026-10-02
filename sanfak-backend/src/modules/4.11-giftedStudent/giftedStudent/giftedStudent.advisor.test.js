jest.mock("#shared/error", () => ({
  ErrorHandler: class ErrorHandler extends Error {
    constructor(status, message, detail) {
      super(message);
      this.status = status;
      this.detail = detail;
    }
  },
}));
jest.mock("exceljs", () => ({ Workbook: class {} }));
jest.mock("../_services/studentAccess", () => ({
  denyStudentAccess: jest.fn(async () => false),
}));
jest.mock("./giftedStudent.model", () => ({
  find: jest.fn(),
  findById: jest.fn(),
  paginate: jest.fn(),
}));

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

const Controller = require("./giftedStudent.controller");
const GiftedStudent = require("./giftedStudent.model");

const ADV_ID = "6a47a5343c087184996522a9";

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

function chainFor(mockFn, docs) {
  const chain = {
    populateArgs: [],
    populate: jest.fn((arg) => {
      chain.populateArgs.push(arg);
      return chain;
    }),
    sort: jest.fn(() => chain),
    lean: jest.fn(async () => docs),
  };
  mockFn.mockReturnValue(chain);
  return chain;
}

const studentDoc = () => ({
  _id: "gs1",
  fullName: "Aliyev Sardor",
  advisorId: ADV_ID,
  advisorName: "ESKI Ismoilov F.B.",
  advisor: { _id: ADV_ID, lastName: "Ismoilov", firstName: "Farrux", middleName: "Baxtiyorovich" },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRows = { faculty: [], direction: [], group: [] };
});

const expectAdvisorPop = (arg) => {
  expect(arg).toBeDefined();
  const fields = arg.select.split(/\s+/).filter(Boolean);
  expect(fields).toEqual(expect.arrayContaining(["lastName", "firstName", "middleName"]));
  ["oneIdPin", "refreshToken", "password"].forEach((f) => expect(arg.select).not.toContain(f));
};

describe("advisor ref populate qilinadi — uchala o'qish yo'lida", () => {
  test("findAllStudents", async () => {
    const chain = chainFor(GiftedStudent.find, []);
    await Controller.findAllStudents({ query: {}, scope: {} }, mockRes(), jest.fn());
    expectAdvisorPop(chain.populateArgs.find((a) => a && a.path === "advisor"));
  });

  test("findOneStudent", async () => {
    const chain = chainFor(GiftedStudent.findById, studentDoc());
    await Controller.findOneStudent(
      { params: { id: "gs1" }, user: { _id: "u1", role: { title: "iqtidorli_bolim" } } },
      mockRes(),
      jest.fn(),
    );
    expectAdvisorPop(chain.populateArgs.find((a) => a && a.path === "advisor"));
  });

  test("paginateStudents — paginate opsiyalarida", async () => {
    GiftedStudent.paginate.mockResolvedValue({ docs: [] });
    await Controller.paginateStudents(
      { query: { page: 1, limit: 20 }, scope: {} },
      mockRes(),
      jest.fn(),
    );
    const options = GiftedStudent.paginate.mock.calls[0][1];
    expect(options.lean).toBe(true);
    expectAdvisorPop((options.populate || []).find((p) => p.path === "advisor"));
  });
});

describe("javob shakli", () => {
  test("`advisor` JONLI obyekt sifatida yetib boradi (FE shuni o'qiydi)", async () => {
    chainFor(GiftedStudent.findById, studentDoc());
    const res = mockRes();
    await Controller.findOneStudent(
      { params: { id: "gs1" }, user: { _id: "u1", role: { title: "iqtidorli_bolim" } } },
      res,
      jest.fn(),
    );

    const [payload] = res.json.mock.calls[0];
    expect(payload.advisor).toEqual({
      _id: ADV_ID,
      lastName: "Ismoilov",
      firstName: "Farrux",
      middleName: "Baxtiyorovich",
    });
  });

  test("`advisorId` satri va `advisorName` zaxirasi TEGILMAYDI", async () => {
    chainFor(GiftedStudent.findById, studentDoc());
    const res = mockRes();
    await Controller.findOneStudent(
      { params: { id: "gs1" }, user: { _id: "u1", role: { title: "iqtidorli_bolim" } } },
      res,
      jest.fn(),
    );

    const [payload] = res.json.mock.calls[0];
    expect(payload.advisorId).toBe(ADV_ID);
    expect(payload.advisorName).toBe("ESKI Ismoilov F.B.");
  });

  test("maslahatchisi yo'q talaba — `advisor: null`, javob yiqilmaydi", async () => {
    chainFor(GiftedStudent.findById, { _id: "gs2", fullName: "X", advisor: null, advisorId: null });
    const res = mockRes();
    await Controller.findOneStudent(
      { params: { id: "gs2" }, user: { _id: "u1", role: { title: "iqtidorli_bolim" } } },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].advisor).toBeNull();
  });
});
