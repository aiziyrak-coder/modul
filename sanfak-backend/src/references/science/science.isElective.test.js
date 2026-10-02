"use strict";

jest.mock("./science.model", () => ({ find: jest.fn(), paginate: jest.fn() }));

const ScienceModel = require("./science.model");
const common = require("#validators/common");
const {
  createScienceSchema,
  updateScienceSchema,
  findAllSciencesQuery,
  paginateSciencesQuery,
} = require("./science.validation");
const Controller = require("./science.controller");

const mockRes = () => {
  const r = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json = jest.fn().mockReturnValue(r);
  return r;
};

const mockFindChain = () => {
  const q = { sort: jest.fn(), populate: jest.fn(), exec: jest.fn().mockResolvedValue([]) };
  q.sort.mockReturnValue(q);
  q.populate.mockReturnValue(q);
  ScienceModel.find.mockReturnValue(q);
};

const findAllFilter = async (query) => {
  mockFindChain();
  const next = jest.fn();
  await Controller.findAll({ query }, mockRes(), next);
  expect(next).not.toHaveBeenCalled();
  return ScienceModel.find.mock.calls[0][0];
};

beforeEach(() => jest.clearAllMocks());

describe("science.validation — `isElective` maydoni", () => {
  test("create va update boolean qabul qiladi", () => {
    expect(createScienceSchema.validate({ title: "Radiatsion gigiyena", isElective: true }).error).toBeUndefined();
    expect(updateScienceSchema.validate({ isElective: false }).error).toBeUndefined();
  });

  test("boolean bo'lmagan qiymat rad etiladi", () => {
    expect(updateScienceSchema.validate({ isElective: "ha" }).error).toBeDefined();
  });
});

describe("science query sxemalari — `?isElective=`", () => {
  test("fanlar ro'yxati `isElective` ni qabul qiladi va boolean'ga aylantiradi", () => {
    const all = findAllSciencesQuery.validate({ active: "true", isElective: "true" });
    expect(all.error).toBeUndefined();
    expect(all.value.isElective).toBe(true);

    const page = paginateSciencesQuery.validate({ page: 1, limit: 50, isElective: "false" });
    expect(page.error).toBeUndefined();
    expect(page.value.isElective).toBe(false);
  });

  test("umumiy `common.findAll`/`common.paginate` TEGILMAGAN — ular `isElective` ni rad etadi", () => {
    expect(common.findAll.validate({ isElective: true }).error).toBeDefined();
    expect(common.paginate.validate({ page: 1, limit: 10, isElective: true }).error).toBeDefined();
  });
});

describe("science.controller — `isElective` filtri", () => {
  test("`true` (boolean yoki satr) → faqat belgili fanlar", async () => {
    expect(await findAllFilter({ isElective: true })).toMatchObject({ isElective: true });
    jest.clearAllMocks();
    expect(await findAllFilter({ isElective: "true" })).toMatchObject({ isElective: true });
  });

  test("`false` → belgisi YO'Q fanlar, maydoni yo'q eski yozuvlar ham (`$ne: true`)", async () => {
    expect(await findAllFilter({ isElective: false })).toMatchObject({ isElective: { $ne: true } });
  });

  test("parametr berilmasa — filtr yo'q (eski xulq)", async () => {
    expect(await findAllFilter({ active: true })).not.toHaveProperty("isElective");
  });

  test("paginate ham xuddi shu filtr bilan", async () => {
    ScienceModel.paginate.mockResolvedValue({ docs: [] });
    const next = jest.fn();
    await Controller.paginate({ query: { page: 1, limit: 50, isElective: true } }, mockRes(), next);
    expect(next).not.toHaveBeenCalled();
    expect(ScienceModel.paginate.mock.calls[0][0]).toMatchObject({ isElective: true });
  });
});
