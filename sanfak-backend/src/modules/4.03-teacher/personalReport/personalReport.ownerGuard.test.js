jest.mock("./personalReport.model");

const PersonalReportModel = require("./personalReport.model");
const service = require("./personalReport.service");
const Controller = require("./personalReport.controller");
const { ROLES } = require("#config/constants");

const REPORT_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const OWNER_ID = "cccccccccccccccccccccccc";
const COLLEAGUE_ID = "dddddddddddddddddddddddd";
const DEPARTMENT_SCOPE = { teacher: { $in: [OWNER_ID, COLLEAGUE_ID] } };

const userWithRole = (title, id) => ({ _id: id, role: { title } });

const reportDoc = ({ status = "draft", teacher = OWNER_ID } = {}) => ({
  _id: REPORT_ID,
  teacher,
  status,
  semester: 1,
  text: "matn",
  save: jest.fn().mockResolvedValue(undefined),
});

const mockFound = (doc) => {
  PersonalReportModel.findOne = jest.fn().mockResolvedValue(doc);
};

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => jest.clearAllMocks());

describe("personalReport.service.update — egalik", () => {
  test("egasi — draft/rejected ni tahrirlaydi", async () => {
    const doc = reportDoc({ status: "draft" });
    mockFound(doc);

    const result = await service.update(
      REPORT_ID,
      userWithRole(ROLES.OQITUVCHI, OWNER_ID),
      DEPARTMENT_SCOPE,
      { text: "yangilangan" },
    );

    expect(result.text).toBe("yangilangan");
  });

  test("hamkasb (begona egalik, department scope drift) — 403", async () => {
    const doc = reportDoc({ status: "draft" });
    mockFound(doc);

    await expect(
      service.update(
        REPORT_ID,
        userWithRole(ROLES.OQITUVCHI, COLLEAGUE_ID),
        DEPARTMENT_SCOPE,
        { text: "hack" },
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Bu hujjat sizga tegishli emas",
    });
    expect(doc.save).not.toHaveBeenCalled();
  });

  test("super_admin — egalik tekshiruvidan OZOD", async () => {
    const doc = reportDoc({ status: "draft" });
    mockFound(doc);

    const result = await service.update(
      REPORT_ID,
      userWithRole(ROLES.SUPER_ADMIN, "admin-1"),
      {},
      { text: "admin-edit" },
    );

    expect(result.text).toBe("admin-edit");
  });
});

describe("personalReport.service.remove — egalik", () => {
  test("egasi — o'chiradi", async () => {
    const doc = reportDoc({ status: "rejected" });
    mockFound(doc);
    PersonalReportModel.deleteOne = jest.fn().mockResolvedValue({});

    await service.remove(
      REPORT_ID,
      DEPARTMENT_SCOPE,
      userWithRole(ROLES.OQITUVCHI, OWNER_ID),
    );

    expect(PersonalReportModel.deleteOne).toHaveBeenCalledWith({ _id: REPORT_ID });
  });

  test("hamkasb (begona egalik) — 403, deleteOne CHAQIRILMAYDI", async () => {
    const doc = reportDoc({ status: "draft" });
    mockFound(doc);
    PersonalReportModel.deleteOne = jest.fn();

    await expect(
      service.remove(
        REPORT_ID,
        DEPARTMENT_SCOPE,
        userWithRole(ROLES.OQITUVCHI, COLLEAGUE_ID),
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Bu hujjat sizga tegishli emas",
    });
    expect(PersonalReportModel.deleteOne).not.toHaveBeenCalled();
  });

  test("controller `deleteReport` — `req.user`ni service.remove'ga uzatadi", async () => {
    const doc = reportDoc({ status: "draft", teacher: OWNER_ID });
    mockFound(doc);
    PersonalReportModel.deleteOne = jest.fn().mockResolvedValue({});
    const next = jest.fn();

    await Controller.deleteReport(
      {
        params: { id: REPORT_ID },
        scope: DEPARTMENT_SCOPE,
        user: userWithRole(ROLES.OQITUVCHI, COLLEAGUE_ID),
      },
      createRes(),
      next,
    );

    expect(next.mock.calls[0][0].statusCode).toBe(403);
  });
});
