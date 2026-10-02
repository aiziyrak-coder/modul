jest.mock("./announcement.model");
jest.mock("./announcement.audience");

const Announcement = require("./announcement.model");
const { resolveAudienceFilter } = require("./announcement.audience");
const Controller = require("./announcement.controller");

const USER_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const SENTINEL_AUDIENCE_OR = [{ __sentinel: true }];

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createFindChain = (resolved = []) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.sort = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(resolved);
  return chain;
};

const createFindOneChain = (resolved = null) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(resolved);
  return chain;
};

beforeEach(() => {
  jest.clearAllMocks();
  resolveAudienceFilter.mockResolvedValue(SENTINEL_AUDIENCE_OR);
});

describe("findAll — auditoriya filtri + xavfsiz projeksiya", () => {
  test("req.user asosida resolveAudienceFilter chaqiriladi va filter.$and ga qo'shiladi", async () => {
    const chain = createFindChain([]);
    Announcement.find = jest.fn().mockReturnValue(chain);

    await Controller.findAll(
      { user: { _id: USER_ID }, query: {} },
      createRes(),
      jest.fn(),
    );

    expect(resolveAudienceFilter).toHaveBeenCalledWith(USER_ID);
    const [filter] = Announcement.find.mock.calls[0];
    expect(filter.$and).toEqual([{ $or: SENTINEL_AUDIENCE_OR }]);
  });

  test("`active` endi query orqali chetlab o'tilmaydi — har doim `true`", async () => {
    const chain = createFindChain([]);
    Announcement.find = jest.fn().mockReturnValue(chain);

    await Controller.findAll(
      { user: { _id: USER_ID }, query: { active: "false" } },
      createRes(),
      jest.fn(),
    );

    const [filter] = Announcement.find.mock.calls[0];
    expect(filter.active).toBe(true);
  });

  test("projeksiya `targetUsers`ni javobdan chiqarib tashlaydi", async () => {
    const chain = createFindChain([]);
    Announcement.find = jest.fn().mockReturnValue(chain);

    await Controller.findAll(
      { user: { _id: USER_ID }, query: {} },
      createRes(),
      jest.fn(),
    );

    const [, projection] = Announcement.find.mock.calls[0];
    expect(projection.targetUsers).toBe(0);
  });

  test("`module` query filtri saqlanib qoladi", async () => {
    const chain = createFindChain([]);
    Announcement.find = jest.fn().mockReturnValue(chain);

    await Controller.findAll(
      { user: { _id: USER_ID }, query: { module: "residency" } },
      createRes(),
      jest.fn(),
    );

    const [filter] = Announcement.find.mock.calls[0];
    expect(filter.module).toBe("residency");
  });
});

describe("getModuleAnnouncements — auditoriya filtri + xavfsiz projeksiya", () => {
  test("resolveAudienceFilter req.user._id bilan chaqiriladi va filter.$and ga qo'shiladi", async () => {
    const chain = createFindChain([]);
    Announcement.find = jest.fn().mockReturnValue(chain);

    await Controller.getModuleAnnouncements(
      { user: { _id: USER_ID }, params: { module: "residency" } },
      createRes(),
      jest.fn(),
    );

    expect(resolveAudienceFilter).toHaveBeenCalledWith(USER_ID);
    const [filter, projection] = Announcement.find.mock.calls[0];
    expect(filter.$and).toEqual([{ $or: SENTINEL_AUDIENCE_OR }]);
    expect(filter.active).toBe(true);
    expect(projection.targetUsers).toBe(0);
  });
});

describe("findOne — IDOR fix: auditoriya + faollik + muddat", () => {
  test("filtr `_id` + `active:true` + auditoriya shartini birga qo'shadi", async () => {
    const chain = createFindOneChain(null);
    Announcement.findOne = jest.fn().mockReturnValue(chain);

    await Controller.findOne(
      { user: { _id: USER_ID }, params: { id: "xyz" } },
      createRes(),
      jest.fn(),
    );

    expect(resolveAudienceFilter).toHaveBeenCalledWith(USER_ID);
    const [filter] = Announcement.findOne.mock.calls[0];
    expect(filter._id).toBe("xyz");
    expect(filter.active).toBe(true);
    expect(filter.$and).toEqual([{ $or: SENTINEL_AUDIENCE_OR }]);
  });

  test("mos kelmasa (auditoriya/faollik/muddat) — 404, endpoint id'ga ishonib to'g'ridan qaytarmaydi", async () => {
    const chain = createFindOneChain(null);
    Announcement.findOne = jest.fn().mockReturnValue(chain);
    const res = createRes();

    await Controller.findOne(
      { user: { _id: USER_ID }, params: { id: "xyz" } },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("getMyAnnouncements / getUnreadCount — bir xil resolver ishlatadi (dublikat qaytmasin)", () => {
  test("getMyAnnouncements resolveAudienceFilter'ni chaqiradi", async () => {
    Announcement.paginate = jest.fn().mockResolvedValue({ docs: [] });

    await Controller.getMyAnnouncements(
      { user: { _id: USER_ID }, query: {} },
      createRes(),
      jest.fn(),
    );

    expect(resolveAudienceFilter).toHaveBeenCalledWith(USER_ID);
  });

  test("getUnreadCount resolveAudienceFilter'ni chaqiradi", async () => {
    Announcement.countDocuments = jest.fn().mockResolvedValue(0);

    await Controller.getUnreadCount(
      { user: { _id: USER_ID }, query: {} },
      createRes(),
      jest.fn(),
    );

    expect(resolveAudienceFilter).toHaveBeenCalledWith(USER_ID);
  });
});
