jest.mock("./personalReport.model");
jest.mock("#modules/4.03-teacher/_shared/chainNotify", () => ({
  safeDispatch: jest.fn().mockResolvedValue(undefined),
  safeDispatchMany: jest.fn().mockResolvedValue(undefined),
  getRecipients: jest.fn().mockResolvedValue([]),
  getRecipientsForSteps: jest.fn().mockResolvedValue([]),
  describeOwner: jest.fn().mockResolvedValue(""),
}));

const PersonalReportModel = require("./personalReport.model");
const Controller = require("./personalReport.controller");
const { ROLES } = require("#config/constants");

const REPORT_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const TEACHER_ID = "cccccccccccccccccccccccc";
const OTHER_TEACHER_ID = "eeeeeeeeeeeeeeeeeeeeeeee";
const SCOPE = { teacher: TEACHER_ID };

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const userWithRole = (title, id = "userid") => ({ _id: id, role: { title } });

const reportDoc = ({ status = "draft", teacher = TEACHER_ID } = {}) => ({
  _id: REPORT_ID,
  teacher,
  status,
  semester: 1,
  text: "Hisobot matni",
  save: jest.fn().mockResolvedValue(undefined),
});

const mockFound = (doc) => {
  PersonalReportModel.findOne = jest.fn().mockResolvedValue(doc);
};

const call = async (
  { params = {}, body = {}, scope = SCOPE, user = userWithRole(ROLES.OQITUVCHI, TEACHER_ID) } = {},
) => {
  const res = createRes();
  const next = jest.fn();
  await Controller.submitReport(
    { params: { id: REPORT_ID, ...params }, body, scope, user },
    res,
    next,
  );
  return { res, next };
};

beforeEach(() => jest.clearAllMocks());

describe("submitReport — POST /:id/submit (draft → submitted)", () => {
  test("egasi (oqituvchi) — `draft` hisobotni yuboradi — 200, status `submitted`", async () => {
    const doc = reportDoc({ status: "draft" });
    mockFound(doc);

    const { res } = await call({ user: userWithRole(ROLES.OQITUVCHI, TEACHER_ID) });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: "submitted" }),
    );
    expect(doc.status).toBe("submitted");
    expect(doc.save).toHaveBeenCalled();
  });

  test("`findOne` scope bilan chaqiriladi (IDOR himoyasi)", async () => {
    const doc = reportDoc({ status: "draft" });
    mockFound(doc);

    await call({ user: userWithRole(ROLES.OQITUVCHI, TEACHER_ID) });

    expect(PersonalReportModel.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: REPORT_ID, ...SCOPE }),
    );
  });

  test("🔴 SECURITY: begona rol (dekan) chaqirsa — 403", async () => {
    const doc = reportDoc({ status: "draft" });
    mockFound(doc);

    const { next } = await call({
      user: userWithRole(ROLES.DEKAN, "boshqa-user-id"),
      scope: {},
    });

    expect(next.mock.calls[0][0].statusCode).toBe(403);
    expect(doc.save).not.toHaveBeenCalled();
  });

  test("🔴 SECURITY: boshqa o'qituvchi (egasi emas) — 403", async () => {
    const doc = reportDoc({ status: "draft", teacher: OTHER_TEACHER_ID });
    mockFound(doc);

    const { next } = await call({ user: userWithRole(ROLES.OQITUVCHI, TEACHER_ID) });

    expect(next.mock.calls[0][0].statusCode).toBe(403);
    expect(doc.save).not.toHaveBeenCalled();
  });

  test("`submitted` holatdan qayta yuborib bo'lmaydi — 400", async () => {
    const doc = reportDoc({ status: "submitted" });
    mockFound(doc);

    const { next } = await call({ user: userWithRole(ROLES.OQITUVCHI, TEACHER_ID) });

    expect(next.mock.calls[0][0].statusCode).toBe(400);
    expect(doc.save).not.toHaveBeenCalled();
  });

  test("`approved` holatdan yuborib bo'lmaydi — 400", async () => {
    const doc = reportDoc({ status: "approved" });
    mockFound(doc);

    const { next } = await call({ user: userWithRole(ROLES.OQITUVCHI, TEACHER_ID) });

    expect(next.mock.calls[0][0].statusCode).toBe(400);
    expect(doc.save).not.toHaveBeenCalled();
  });

  test("`rejected` holatdan yuborib bo'lmaydi — 400 (avval qayta tahrirlanib `draft`ga qaytishi kerak)", async () => {
    const doc = reportDoc({ status: "rejected" });
    mockFound(doc);

    const { next } = await call({ user: userWithRole(ROLES.OQITUVCHI, TEACHER_ID) });

    expect(next.mock.calls[0][0].statusCode).toBe(400);
    expect(doc.save).not.toHaveBeenCalled();
  });

  test("super_admin — egalik tekshiruvisiz yuboradi — 200", async () => {
    const doc = reportDoc({ status: "draft", teacher: OTHER_TEACHER_ID });
    mockFound(doc);

    const { res } = await call({
      user: userWithRole(ROLES.SUPER_ADMIN, "super-admin-id"),
      scope: {},
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(doc.status).toBe("submitted");
  });

  test("mavjud bo'lmagan hisobot — 404", async () => {
    mockFound(null);

    const { next } = await call({ user: userWithRole(ROLES.OQITUVCHI, TEACHER_ID) });

    expect(next.mock.calls[0][0].statusCode).toBe(404);
  });
});
