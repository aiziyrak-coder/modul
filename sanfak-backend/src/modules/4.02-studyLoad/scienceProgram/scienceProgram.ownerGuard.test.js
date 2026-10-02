jest.mock("./scienceProgram.model");

const ScienceProgram = require("./scienceProgram.model");
const Controller = require("./scienceProgram.controller");
const { ROLES } = require("#config/constants");

const DOC_ID = "cccccccccccccccccccccccc";
const OWNER_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const COLLEAGUE_ID = "dddddddddddddddddddddddd";
const DEPARTMENT_SCOPE = { user: { $in: [OWNER_ID, COLLEAGUE_ID] } };

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const userWithRole = (title, id) => ({ _id: id, role: { title } });

beforeEach(() => jest.clearAllMocks());

describe("archiveScienceProgram — egalik", () => {
  const doc = () => ({
    _id: DOC_ID,
    status: "draft",
    archivedAt: null,
    user: OWNER_ID,
    archive: jest.fn().mockResolvedValue(undefined),
  });

  test("egasi — arxivlaydi (200)", async () => {
    const d = doc();
    ScienceProgram.findOne = jest.fn().mockResolvedValue(d);
    const res = createRes();

    await Controller.archiveScienceProgram(
      {
        params: { id: DOC_ID },
        body: {},
        scope: DEPARTMENT_SCOPE,
        user: userWithRole(ROLES.OQITUVCHI, OWNER_ID),
      },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(d.archive).toHaveBeenCalled();
  });

  test("hamkasb (begona egalik, department scope drift) — 403, archive() CHAQIRILMAYDI", async () => {
    const d = doc();
    ScienceProgram.findOne = jest.fn().mockResolvedValue(d);
    const next = jest.fn();

    await Controller.archiveScienceProgram(
      {
        params: { id: DOC_ID },
        body: {},
        scope: DEPARTMENT_SCOPE,
        user: userWithRole(ROLES.OQITUVCHI, COLLEAGUE_ID),
      },
      createRes(),
      next,
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, message: "Bu hujjat sizga tegishli emas" }),
    );
    expect(d.archive).not.toHaveBeenCalled();
  });

  test("super_admin — egalik tekshiruvidan OZOD", async () => {
    const d = doc();
    ScienceProgram.findOne = jest.fn().mockResolvedValue(d);
    const res = createRes();

    await Controller.archiveScienceProgram(
      {
        params: { id: DOC_ID },
        body: {},
        scope: {},
        user: userWithRole(ROLES.SUPER_ADMIN, "admin-1"),
      },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(d.archive).toHaveBeenCalled();
  });
});

describe("restoreScienceProgram — egalik (🔴 bugun jonli yetiladi)", () => {
  const archivedDoc = () => ({
    _id: DOC_ID,
    status: "draft",
    deletedAt: null,
    archivedAt: new Date("2026-01-01"),
    user: OWNER_ID,
    unarchive: jest.fn().mockResolvedValue(undefined),
    restore: jest.fn().mockResolvedValue(undefined),
  });

  test("hamkasb (begona egalik) — B ning arxivlangan hujjatini QAYTARA OLMAYDI (403)", async () => {
    const d = archivedDoc();
    ScienceProgram.findOneWithDeleted = jest.fn().mockResolvedValue(d);
    const next = jest.fn();

    await Controller.restoreScienceProgram(
      {
        params: { id: DOC_ID },
        scope: DEPARTMENT_SCOPE,
        user: userWithRole(ROLES.OQITUVCHI, COLLEAGUE_ID),
      },
      createRes(),
      next,
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, message: "Bu hujjat sizga tegishli emas" }),
    );
    expect(d.unarchive).not.toHaveBeenCalled();
  });

  test("egasi — qaytara oladi (200)", async () => {
    const d = archivedDoc();
    ScienceProgram.findOneWithDeleted = jest.fn().mockResolvedValue(d);
    const res = createRes();

    await Controller.restoreScienceProgram(
      {
        params: { id: DOC_ID },
        scope: DEPARTMENT_SCOPE,
        user: userWithRole(ROLES.OQITUVCHI, OWNER_ID),
      },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(d.unarchive).toHaveBeenCalled();
  });

  test("super_admin — egalik tekshiruvidan OZOD", async () => {
    const d = archivedDoc();
    ScienceProgram.findOneWithDeleted = jest.fn().mockResolvedValue(d);
    const res = createRes();

    await Controller.restoreScienceProgram(
      {
        params: { id: DOC_ID },
        scope: {},
        user: userWithRole(ROLES.SUPER_ADMIN, "admin-1"),
      },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(d.unarchive).toHaveBeenCalled();
  });
});
