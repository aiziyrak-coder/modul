"use strict";

const mockFind = jest.fn();

jest.mock("./residencyLesson.model", () => ({
  find: (...a) => mockFind(...a),
  paginate: jest.fn(),
}));
jest.mock("#modules/4.05-residency/resident/resident.model", () => ({
  find: jest.fn(),
}));

const mockAllowedResidentIds = jest.fn();
jest.mock("../_services/residentScope", () => ({
  allowedResidentIds: (...a) => mockAllowedResidentIds(...a),
}));

const Resident = require("#modules/4.05-residency/resident/resident.model");
const C = require("./residencyLesson.controller");

const GROUP_A = "64b2f0c2a1b2c3d4e5f60701";
const GROUP_B = "64b2f0c2a1b2c3d4e5f60702";
const GROUP_X = "64b2f0c2a1b2c3d4e5f607ff";

const resFor = () => {
  const r = {};
  r.status = jest.fn(() => r);
  r.json = jest.fn(() => r);
  return r;
};

const givenScope = (groupIds) => {
  if (groupIds === null) {
    mockAllowedResidentIds.mockResolvedValue(null);
    return;
  }
  mockAllowedResidentIds.mockResolvedValue(["r1"]);
  Resident.find.mockReturnValue({ distinct: jest.fn().mockResolvedValue(groupIds) });
};

const filterFor = async (query) => {
  mockFind.mockReturnValue({
    populate: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([]) }),
  });
  const next = jest.fn();
  await C.findAllLessons({ query, user: { _id: "u1" } }, resFor(), next);
  expect(next).not.toHaveBeenCalled();
  return mockFind.mock.calls[0][0];
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("residencyLesson — guruh filtri doirani bosib ketmaydi", () => {
  test("doiradagi guruh tanlansa filtr TORAYADI", async () => {
    givenScope([GROUP_A, GROUP_B]);
    const filter = await filterFor({ group: GROUP_A });
    expect(filter["groups.group"]).toBe(GROUP_A);
  });

  test("guruh tanlanmasa doira TO'LIQ saqlanadi", async () => {
    givenScope([GROUP_A, GROUP_B]);
    const filter = await filterFor({});
    expect(filter["groups.group"]).toEqual({ $in: [GROUP_A, GROUP_B] });
  });

  test("doiradan TASHQARIDAGI guruh bo'sh natija beradi (doirani KENGAYTIRMAYDI)", async () => {
    givenScope([GROUP_A]);
    const filter = await filterFor({ group: GROUP_X });
    expect(filter["groups.group"]).toEqual({ $in: [] });
  });

  test("cheklovsiz doirada guruh erkin filtrlanadi", async () => {
    givenScope(null);
    const filter = await filterFor({ group: GROUP_X });
    expect(filter["groups.group"]).toBe(GROUP_X);
  });
});

describe("residencyLesson — qidiruv", () => {
  test("qism-satr bo'yicha, registrga sezgir emas (tenglik EMAS)", async () => {
    givenScope(null);
    const filter = await filterFor({ search: "anatom" });
    expect(filter.scienceTitle).toEqual({ $regex: "anatom", $options: "i" });
  });

  test("metakarakterlar escape qilinadi — so'rov yiqilmaydi", async () => {
    givenScope(null);
    const filter = await filterFor({ search: "Kimyo (asosiy)" });
    expect(() => new RegExp(filter.scienceTitle.$regex)).not.toThrow();
    expect("Umumiy kimyo (asosiy) fani").toMatch(
      new RegExp(filter.scienceTitle.$regex, filter.scienceTitle.$options),
    );
  });

  test("bosh/oxirgi bo'shliqlar olib tashlanadi", async () => {
    givenScope(null);
    const filter = await filterFor({ search: "  anatomiya  " });
    expect(filter.scienceTitle.$regex).toBe("anatomiya");
  });

  test.each(["", "   "])("bo'sh so'rovda filtr UMUMAN qo'yilmaydi (%p)", async (search) => {
    givenScope(null);
    const filter = await filterFor({ search });
    expect(filter.scienceTitle).toBeUndefined();
  });

  test("kirill matni ham registrga sezgir emas", async () => {
    givenScope(null);
    const filter = await filterFor({ search: "ҲУЖАЙРА" });
    expect("Одам ҳужайра биологияси").toMatch(
      new RegExp(filter.scienceTitle.$regex, filter.scienceTitle.$options),
    );
  });
});
