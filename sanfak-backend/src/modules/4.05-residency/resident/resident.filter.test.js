"use strict";

const mockFind = jest.fn();

jest.mock("./resident.model", () => ({
  find: (...a) => mockFind(...a),
  paginate: jest.fn(),
}));
jest.mock("#modules/4.01-auth/user/user.model", () => ({
  find: jest.fn(),
  findOne: jest.fn(),
}));

const C = require("./resident.controller");

const resFor = () => {
  const r = {};
  r.status = jest.fn(() => r);
  r.json = jest.fn(() => r);
  return r;
};

const filterFor = async (query, scope = {}) => {
  mockFind.mockReturnValue({
    populate: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([]) }),
  });
  const next = jest.fn();
  await C.findAllResidents({ query, scope, user: { _id: "u1" } }, resFor(), next);
  expect(next).not.toHaveBeenCalled();
  return mockFind.mock.calls[0][0];
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("resident — qidiruv filtri", () => {
  test("bitta harf QISM-SATR bo'yicha qidiradi (tenglik EMAS)", async () => {
    const filter = await filterFor({ search: "a" });
    expect(filter.$or).toEqual([
      { fullName: { $regex: "a", $options: "i" } },
      { jshshir: { $regex: "a", $options: "i" } },
    ]);
  });

  test("metakarakterlar escape qilinadi — `(` so'rovni yiqitmaydi", async () => {
    const filter = await filterFor({ search: "(a+)+" });
    const pattern = filter.$or[0].fullName.$regex;
    expect(() => new RegExp(pattern)).not.toThrow();
    expect(new RegExp(pattern, "i").test("Test (a+)+ nomi")).toBe(true);
    expect(new RegExp(pattern, "i").test("aaaa")).toBe(false);
  });

  test("bo'shliqlar olib tashlanadi va ichkarisi bittaga siqiladi", async () => {
    const filter = await filterFor({ search: "  Ali   Vali  " });
    expect(filter.$or[0].fullName.$regex).toBe("Ali Vali");
  });

  test("faqat bo'shliqdan iborat so'rov filtr QO'YMAYDI", async () => {
    const filter = await filterFor({ search: "   " });
    expect(filter.$or).toBeUndefined();
  });

  test("bo'sh so'rov filtr QO'YMAYDI", async () => {
    const filter = await filterFor({ search: "" });
    expect(filter.$or).toBeUndefined();
  });

  test("kirill matni ham registrga sezgir emas (`i` bayrog'i)", async () => {
    const filter = await filterFor({ search: "ЎҲ" });
    expect(filter.$or[0].fullName).toEqual({ $regex: "ЎҲ", $options: "i" });
  });

  test("qidiruv ko'rish doirasini BOSIB KETMAYDI", async () => {
    const filter = await filterFor({ search: "a" }, { department: "d1" });
    expect(filter.department).toBe("d1");
  });
});
