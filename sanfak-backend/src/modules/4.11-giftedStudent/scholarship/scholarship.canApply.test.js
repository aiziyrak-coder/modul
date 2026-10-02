"use strict";

jest.mock("#shared/error", () => ({
  ErrorHandler: class ErrorHandler extends Error {
    constructor(status, message, detail) {
      super(message);
      this.detail = detail;
    }
  },
}));
jest.mock("../_services/freshTitles", () => ({ applyFreshTitles: async (d) => d }));
jest.mock("../_services/scoringComplete", () => ({
  isScoringComplete: jest.fn(async () => false),
  touchesScoring: jest.fn(() => false),
}));
jest.mock("../_services/roleEligibility", () => ({
  ...jest.requireActual("../_services/roleEligibility"),
  rolesGranting: jest.fn(async () => []),
}));
jest.mock("../_services/userCandidates", () => ({ usersWithRoles: jest.fn(async () => []) }));
jest.mock("#modules/4.11-giftedStudent/scholarshipApplication/scholarshipApplication.model", () => ({
  find: jest.fn(),
}));
jest.mock("#modules/4.11-giftedStudent/giftedStudent/giftedStudent.model", () => ({
  findOne: jest.fn(),
}));

jest.mock("./scholarship.model", () => {
  const rows = () =>
    [
      { name: "Ochiq", active: true, minScore: 0, allowedCourses: [], deadline: null },
      {
        name: "Muddati o'tgan",
        active: true,
        minScore: 0,
        allowedCourses: [],
        deadline: new Date(2020, 0, 1),
      },
    ].map((r) => ({ toObject: () => ({ ...r }) }));
  return {
    find: jest.fn(() => ({ exec: jest.fn(async () => rows()) })),
    paginate: jest.fn(async () => ({ docs: rows(), totalDocs: 2 })),
  };
});

const Controller = require("./scholarship.controller");
const GiftedStudent = require("#modules/4.11-giftedStudent/giftedStudent/giftedStudent.model");
const { currentAcademicYear } = require("../_services/academicYearWindow");
const { MODULES, ACTIONS } = require("#config/constants");

const YIL = currentAcademicYear();

const talaba = {
  _id: "u1",
  role: {
    title: "talaba",
    permissions: [{ section: MODULES.STUDENT_ACHIEVEMENT, actionKeys: [ACTIONS.CREATE] }],
  },
};
const bolim = {
  _id: "u2",
  role: {
    title: "iqtidorli_bolim",
    permissions: [
      { section: MODULES.STUDENT_ACHIEVEMENT, actionKeys: [ACTIONS.CREATE] },
      { section: MODULES.GIFTED_STUDENT, actionKeys: [ACTIONS.CREATE] },
    ],
  },
};

const mockRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });

const giftedIs = (value) =>
  GiftedStudent.findOne.mockReturnValue({
    select: jest.fn(() => ({ lean: jest.fn(async () => value) })),
  });

const listAs = async (user) => {
  const res = mockRes();
  const next = jest.fn();
  await Controller.findAllScholarships({ query: {}, user }, res, next);
  if (!res.json.mock.calls.length) {
    const e = next.mock.calls[0]?.[0];
    throw new Error(`${e?.message} :: ${e?.detail}`);
  }
  return res.json.mock.calls[0][0];
};

beforeEach(() => jest.clearAllMocks());

describe("GET /scholarships — canApply", () => {
  test("🔴 talaba: muddati o'tgan stipendiya RAD etiladi", async () => {
    giftedIs({ course: 1, scoresByYear: { [YIL]: 100 } });
    const out = await listAs(talaba);
    expect(out[0].canApply).toBe(true);
    expect(out[1].canApply).toBe(false);
    expect(out[1].canApplyReason).toMatch(/muddati tugagan/);
  });

  test("🔴 bo'lim xodimi: javobda maydon UMUMAN yo'q", async () => {
    const out = await listAs(bolim);
    expect(out[0]).not.toHaveProperty("canApply");
    expect(out[0]).not.toHaveProperty("canApplyReason");
    expect(GiftedStudent.findOne).not.toHaveBeenCalled();
  });

  test("talaba yozuvi BIR MARTA olinadi (N+1 yo'q)", async () => {
    giftedIs({ course: 1, scoresByYear: { [YIL]: 100 } });
    await listAs(talaba);
    expect(GiftedStudent.findOne).toHaveBeenCalledTimes(1);
  });

  test("reestrda bo'lmagan talaba — sabab ko'rsatiladi", async () => {
    giftedIs(null);
    const out = await listAs(talaba);
    expect(out[0].canApply).toBe(false);
    expect(out[0].canApplyReason).toMatch(/ro'yxatida emassiz/);
  });

  test("stipendiyaning boshqa maydonlari SAQLANADI", async () => {
    giftedIs({ course: 1, scoresByYear: { [YIL]: 100 } });
    const out = await listAs(talaba);
    expect(out[0].name).toBe("Ochiq");
    expect(out).toHaveLength(2);
  });
});

describe("GET /scholarships/paginate — BIR XIL qoida", () => {
  const paginateAs = async (user) => {
    const res = mockRes();
    await Controller.paginateScholarships(
      { query: { page: "1", limit: "10" }, user },
      res,
      jest.fn(),
    );
    return res.json.mock.calls[0][0];
  };

  test("talaba: `docs` ichida shart bor, envelope buzilmaydi", async () => {
    giftedIs({ course: 1, scoresByYear: { [YIL]: 100 } });
    const out = await paginateAs(talaba);
    expect(out.totalDocs).toBe(2);
    expect(out.docs.map((s) => s.canApply)).toEqual([true, false]);
  });

  test("bo'lim: `docs` TEGILMAYDI", async () => {
    const out = await paginateAs(bolim);
    expect(out.docs[0]).not.toHaveProperty("canApply");
  });
});
