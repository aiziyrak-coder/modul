"use strict";

const mockFind = jest.fn();
const mockAggregate = jest.fn();

jest.mock("./residentApplication.model", () => ({
  find: (...a) => mockFind(...a),
  paginate: jest.fn(),
  aggregate: (...a) => mockAggregate(...a),
}));
jest.mock("#modules/4.05-residency/resident/resident.model", () => ({
  find: jest.fn(),
}));
jest.mock("#modules/4.05-residency/attendance/attendance.model", () => ({
  updateMany: jest.fn(),
}));

const mockScope = jest.fn();
jest.mock("#modules/4.05-residency/_services/residentScope", () => ({
  buildResidentScope: (...a) => mockScope(...a),
  denyActForResident: jest.fn(),
}));

const C = require("./residentApplication.controller");

const resFor = () => {
  const r = {};
  r.status = jest.fn(() => r);
  r.json = jest.fn(() => r);
  return r;
};

const filterFor = async (query) => {
  mockFind.mockReturnValue({
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockResolvedValue([]),
  });
  const next = jest.fn();
  await C.findAllApplications({ query, user: { _id: "u1" } }, resFor(), next);
  expect(next).not.toHaveBeenCalled();
  return mockFind.mock.calls[0][0];
};

const matchFor = async (query) => {
  mockAggregate.mockResolvedValue([]);
  const next = jest.fn();
  await C.statsApplications({ query, user: { _id: "u1" } }, resFor(), next);
  expect(next).not.toHaveBeenCalled();
  return mockAggregate.mock.calls[0][0][0].$match;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockScope.mockResolvedValue({ filter: {}, denied: false });
});

describe("residentApplication — qidiruv filtri", () => {
  test("bitta harf QISM-SATR bo'yicha qidiradi (tenglik EMAS)", async () => {
    const filter = await filterFor({ search: "a" });
    expect(filter.reason).toEqual({ $regex: "a", $options: "i" });
  });

  test("metakarakterlar escape qilinadi", async () => {
    const filter = await filterFor({ search: "50% (a+)" });
    const pattern = filter.reason.$regex;
    expect(() => new RegExp(pattern)).not.toThrow();
    expect(new RegExp(pattern, "i").test("Sabab: 50% (a+) uchun")).toBe(true);
    expect(new RegExp(pattern, "i").test("aaaa")).toBe(false);
  });

  test("faqat bo'shliqdan iborat so'rov filtr QO'YMAYDI", async () => {
    const filter = await filterFor({ search: "   " });
    expect(filter.reason).toBeUndefined();
  });

  test("ichki bo'shliqlar bittaga siqiladi", async () => {
    const filter = await filterFor({ search: " oila  sharoiti " });
    expect(filter.reason.$regex).toBe("oila sharoiti");
  });
});

describe("residentApplication — StatCards ro'yxat bilan bir xil sanaydi", () => {
  test("`?type` va `?search` kartochkalarga ham qo'llanadi", async () => {
    const match = await matchFor({ type: "akademik_tatil", search: "oila" });
    expect(match.type).toBe("akademik_tatil");
    expect(match.reason).toEqual({ $regex: "oila", $options: "i" });
  });

  test("`status` kartochkalarga QO'LLANMAYDI (kesim aynan holat bo'yicha)", async () => {
    const match = await matchFor({ status: "tasdiqlangan" });
    expect(match.status).toBeUndefined();
  });

  test("standart holat — faqat faol arizalar", async () => {
    const match = await matchFor({});
    expect(match.active).toBe(true);
  });

  test("`?active=false` SATRI boolean'ga keltiriladi (aggregate cast qilmaydi)", async () => {
    const match = await matchFor({ active: "false" });
    expect(match.active).toBe(false);
  });

  test("qs obyekti (`?type[$ne]=`) `$match` ga OPERATOR bo'lib tushmaydi", async () => {
    const match = await matchFor({ type: { $ne: "akademik_tatil" } });
    expect(typeof match.type).toBe("string");
  });

  test("ko'rish doirasi saqlanadi", async () => {
    mockScope.mockResolvedValue({ filter: { resident: { $in: ["r1"] } }, denied: false });
    const match = await matchFor({ search: "oila" });
    expect(match.resident).toEqual({ $in: ["r1"] });
  });
});
