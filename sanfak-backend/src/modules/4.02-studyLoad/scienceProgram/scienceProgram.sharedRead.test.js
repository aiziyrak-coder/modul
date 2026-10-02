const ScienceProgram = require("./scienceProgram.model");
const Controller = require("./scienceProgram.controller");
const { ROLES } = require("#config/constants");

const ME = "507f1f77bcf86cd799439011";
const SHARED_SCOPE = {
  $or: [{ user: ME }, { status: "approved", science: { $in: ["sci1", "sci2"] } }],
};

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createReq = (scope, extra = {}) => ({
  query: { page: "1", limit: "10" },
  params: {},
  body: {},
  scope,
  user: { _id: ME, role: { title: ROLES.OQITUVCHI } },
  ...extra,
});

const chainQuery = (resolvedDoc) => {
  const q = {};
  q.populate = jest.fn().mockReturnValue(q);
  q.exec = jest.fn().mockResolvedValue(resolvedDoc);
  return q;
};

afterEach(() => jest.restoreAllMocks());

describe("T-05 — paginate: $or scope + zanjir $or → $and (ikkalasi ham saqlanadi)", () => {
  test("filtrda $and: scope shoxi (approved+science) va zanjir shoxi (formVersion) birga", async () => {
    const spy = jest
      .spyOn(ScienceProgram, "paginate")
      .mockResolvedValue({ docs: [] });
    const res = createRes();

    await Controller.paginateSciencePrograms(createReq(SHARED_SCOPE), res, jest.fn());

    const filter = spy.mock.calls[0][0];
    expect(Array.isArray(filter.$and)).toBe(true);
    const scopePart = filter.$and.find(
      (f) => Array.isArray(f.$or) && f.$or.some((b) => b.status === "approved"),
    );
    const chainPart = filter.$and.find(
      (f) => Array.isArray(f.$or) && f.$or.some((b) => b.formVersion !== undefined),
    );
    expect(scopePart).toBeDefined();
    expect(scopePart.$or).toEqual(SHARED_SCOPE.$or);
    expect(scopePart.active).toBe(true);
    expect(chainPart).toBeDefined();
  });

  test("`?status=approved` (sillabus wizard'i) — status filtri saqlanadi, scope $or yo'qolmaydi", async () => {
    const spy = jest
      .spyOn(ScienceProgram, "paginate")
      .mockResolvedValue({ docs: [] });
    const res = createRes();
    const req = createReq(SHARED_SCOPE, {
      query: { page: "1", limit: "10", status: "approved" },
    });

    await Controller.paginateSciencePrograms(req, res, jest.fn());

    const filter = spy.mock.calls[0][0];
    const parts = filter.$and || [filter];
    expect(parts.some((f) => f.status === "approved")).toBe(true);
    expect(
      parts.some((f) => Array.isArray(f.$or) && f.$or.some((b) => b.science)),
    ).toBe(true);
  });
});

describe("T-05 — findOne: hamkasbning approved dasturi $or scope bilan topiladi", () => {
  test("findOne filtri _id + $or (scope) bilan; topilsa 200", async () => {
    const spy = jest
      .spyOn(ScienceProgram, "findOne")
      .mockReturnValue(chainQuery({ _id: "sp-colleague", status: "approved" }));
    const res = createRes();
    const req = createReq(SHARED_SCOPE, { params: { id: "6a981782d62556d447843c60" } });

    await Controller.findOneScienceProgram(req, res, jest.fn());

    const filter = spy.mock.calls[0][0];
    expect(filter._id).toBe("6a981782d62556d447843c60");
    const parts = filter.$and || [filter];
    expect(parts.some((f) => f.$or && f.$or === SHARED_SCOPE.$or)).toBe(true);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
