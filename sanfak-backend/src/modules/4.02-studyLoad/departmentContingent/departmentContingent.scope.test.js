"use strict";

jest.mock("#modules/4.02-studyLoad/_shared/scopeHelpers", () => ({
  resolveFacultyDepartmentIds: jest.fn(),
}));
jest.mock("./departmentContingent.model", () => ({
  exists: jest.fn(),
  create: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
}));
jest.mock("#references/_services/courseResolver", () => ({ resolveCourse: jest.fn() }));

const { resolveFacultyDepartmentIds } = require("#modules/4.02-studyLoad/_shared/scopeHelpers");
const Model = require("./departmentContingent.model");
const scopeMiddleware = require("./departmentContingent.scope");
const service = require("./departmentContingent.service");

const DEP = "d".repeat(24);
const user = (scopeLevel, over = {}) => ({ _id: "u1", role: { title: "x", scopeLevel }, ...over });

const runScope = async (u) => {
  const req = { user: u };
  const next = jest.fn();
  await scopeMiddleware()(req, {}, next);
  return { req, err: next.mock.calls[0][0] };
};

beforeEach(() => jest.clearAllMocks());

describe("scope middleware", () => {
  test("global → {}", async () => {
    const { req, err } = await runScope(user("global"));
    expect(err).toBeUndefined();
    expect(req.scope).toEqual({});
  });

  test("department → o'z kafedrasi", async () => {
    const { req } = await runScope(user("department", { department: { _id: DEP } }));
    expect(req.scope).toEqual({ department: DEP });
  });

  test("department, kafedra biriktirilmagan → 403", async () => {
    const { err } = await runScope(user("department"));
    expect(err.statusCode).toBe(403);
  });

  test("faculty → fakultet kafedralari ($in) — dekanni keyin seed bilan qo'shish uchun", async () => {
    resolveFacultyDepartmentIds.mockResolvedValue(["k1", "k2"]);
    const { req } = await runScope(user("faculty"));
    expect(req.scope).toEqual({ department: { $in: ["k1", "k2"] } });
  });

  test("self → 403 (fail-closed)", async () => {
    const { err } = await runScope(user("self"));
    expect(err.statusCode).toBe(403);
  });
});

describe("yozish darvozasi — faqat bitta kafedra (O'UB faqat ko'radi)", () => {
  test.each([
    ["global {}", {}],
    ["fakultet $in", { department: { $in: [DEP] } }],
  ])("%s → 403", (_label, scope) => {
    expect(() => service.writerDepartment(scope)).toThrow(expect.objectContaining({ statusCode: 403 }));
  });

  test("kafedra scope → kafedra id", () => {
    expect(service.writerDepartment({ department: DEP })).toBe(DEP);
  });

  test("createContingent — shu yil uchun bor bo'lsa 409", async () => {
    Model.exists.mockResolvedValue(true);
    await expect(
      service.createContingent({ scope: { department: DEP }, academicYear: "y1", userId: "u1" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(Model.create).not.toHaveBeenCalled();
  });
});

describe("IDOR va ro'yxat filtri (K6)", () => {
  test("updateContingent — hujjat scope bilan izlanadi; boshqa kafedraniki 404", async () => {
    Model.findOne.mockResolvedValue(null);
    await expect(
      service.updateContingent({ id: "x1", scope: { department: DEP }, rows: [], userId: "u1" }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(Model.findOne).toHaveBeenCalledWith({ _id: "x1", active: true, department: DEP });
  });

  test("listFilter — kafedra scope'ida `department` so'rovi e'tiborsiz", () => {
    const filter = service.listFilter({ department: DEP }, { department: "boshqa", academicYear: "y1" });
    expect(filter).toEqual({ active: true, department: DEP, academicYear: "y1" });
  });

  test("listFilter — global scope'da `department` filtr sifatida qo'llanadi", () => {
    expect(service.listFilter({}, { department: DEP })).toEqual({ active: true, department: DEP });
  });
});
