jest.mock("./personalReport.model");
jest.mock("#modules/4.03-teacher/_shared/chainNotify", () => ({
  safeDispatch: jest.fn().mockResolvedValue(undefined),
  safeDispatchMany: jest.fn().mockResolvedValue(undefined),
  getRecipients: jest.fn().mockResolvedValue([]),
  getRecipientsForSteps: jest.fn().mockResolvedValue([]),
  describeOwner: jest.fn().mockResolvedValue(""),
}));
jest.mock("#modules/4.03-teacher/personalWorkPlan/personalWorkPlan.model");

const PersonalReportModel = require("./personalReport.model");
const PersonalWorkPlanModel = require("#modules/4.03-teacher/personalWorkPlan/personalWorkPlan.model");
const Controller = require("./personalReport.controller");
const { ROLES } = require("#config/constants");

const REPORT_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const TEACHER_ID = "cccccccccccccccccccccccc";
const PLAN_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const SCOPE = { teacher: { $in: [TEACHER_ID] } };

const mockPlanOwner = (teacherId) => {
  PersonalWorkPlanModel.findById = jest.fn().mockReturnValue({
    lean: () => ({ exec: () => Promise.resolve(teacherId ? { _id: PLAN_ID, teacher: teacherId } : null) }),
  });
};

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const userWithRole = (title, id = "userid") => ({ _id: id, role: { title } });

const buildApprovals = (overrides = {}) =>
  [
    { step: "dekan", label: "Fakultet dekani" },
    { step: "kotib", label: "Fakultet ilmiy kengash kotibi" },
  ].map(({ step, label }) => ({
    step,
    label,
    status: overrides[step] || "pending",
    approvedBy: null,
    date: null,
    comment: null,
    eriSignature: null,
    eriSerial: null,
    eriSignedAt: null,
  }));

const reportDoc = ({ status = "draft", approvals, teacher = TEACHER_ID } = {}) => ({
  _id: REPORT_ID,
  teacher,
  status,
  semester: 1,
  text: "Hisobot matni",
  approvals: approvals || buildApprovals(),
  save: jest.fn().mockResolvedValue(undefined),
});

const mockFound = (doc) => {
  PersonalReportModel.findOne = jest.fn().mockResolvedValue(doc);
};

const call = async (
  handler,
  { params = {}, body = {}, scope = SCOPE, user = userWithRole(ROLES.OQITUVCHI, TEACHER_ID) } = {},
) => {
  const res = createRes();
  const next = jest.fn();
  await handler({ params: { id: REPORT_ID, ...params }, body, scope, user }, res, next);
  return { res, next };
};

beforeEach(() => jest.clearAllMocks());

describe("addReport — POST / (yaratish)", () => {
  test("🔴 SECURITY: `teacher` HAR DOIM `req.user._id` — klient boshqa id yuborsa e'tiborsiz", async () => {
    mockPlanOwner(TEACHER_ID);
    const captured = [];
    PersonalReportModel.mockImplementation((data) => {
      captured.push(data);
      return { ...data, _id: REPORT_ID, save: jest.fn().mockResolvedValue(undefined) };
    });

    const { res } = await call(Controller.addReport, {
      body: {
        plan: PLAN_ID,
        academicYear: "dddddddddddddddddddddddd",
        semester: 1,
        text: "Hisobot",
        teacher: "boshqa-oqituvchi-id",
      },
      user: userWithRole(ROLES.OQITUVCHI, TEACHER_ID),
    });

    expect(res.status).toHaveBeenCalledWith(201);
    expect(captured[0].teacher).toBe(TEACHER_ID);
  });

  test("yaratilganda `status: draft`", async () => {
    mockPlanOwner(TEACHER_ID);
    const captured = [];
    PersonalReportModel.mockImplementation((data) => {
      captured.push(data);
      return { ...data, _id: REPORT_ID, save: jest.fn().mockResolvedValue(undefined) };
    });

    await call(Controller.addReport, {
      body: { plan: PLAN_ID, academicYear: "d", semester: 2, text: "x" },
    });

    expect(captured[0].status).toBe("draft");
  });

  test("🔴 SECURITY: begona rejaga hisobot biriktirilmaydi — 403", async () => {
    mockPlanOwner("ffffffffffffffffffffffff");
    PersonalReportModel.mockImplementation(() => ({
      save: jest.fn().mockResolvedValue(undefined),
    }));

    const { next } = await call(Controller.addReport, {
      body: { plan: PLAN_ID, academicYear: "d", semester: 1, text: "x" },
    });

    const err = next.mock.calls[0][0];
    expect(err.statusCode || err.status).toBe(403);
    expect(PersonalReportModel).not.toHaveBeenCalled();
  });

  test("mavjud bo'lmagan rejaga hisobot — 404", async () => {
    mockPlanOwner(null);
    PersonalReportModel.mockImplementation(() => ({
      save: jest.fn().mockResolvedValue(undefined),
    }));

    const { next } = await call(Controller.addReport, {
      body: { plan: PLAN_ID, academicYear: "d", semester: 1, text: "x" },
    });

    const err = next.mock.calls[0][0];
    expect(err.statusCode || err.status).toBe(404);
  });
});

describe("Tasdiqlash zanjiri — TZ 4.3.7/4.3.8 (dekan/kotib, ixtiyoriy tartib)", () => {
  test.each([
    [ROLES.DEKAN, "dekan"],
    [ROLES.FAKULTET_KENGASH_KOTIBI, "kotib"],
  ])("%s — o'z bosqichini (%s) tasdiqlaydi", async (roleTitle, step) => {
    const doc = reportDoc({ status: "submitted" });
    mockFound(doc);

    const { res } = await call(Controller.approveReport, { user: userWithRole(roleTitle) });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(doc.approvals.find((s) => s.step === step).status).toBe("approved");
    expect(doc.status).toBe("submitted");
  });

  test("ikkisi ham tasdiqlagach — `approved`ga o'tadi", async () => {
    const doc = reportDoc({ status: "submitted", approvals: buildApprovals({ dekan: "approved" }) });
    mockFound(doc);

    const { res } = await call(Controller.approveReport, {
      user: userWithRole(ROLES.FAKULTET_KENGASH_KOTIBI),
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(doc.status).toBe("approved");
  });

  test("🔴 SECURITY: `oqituvchi` chaqirsa — 403, DB so'rovi qilinmaydi", async () => {
    PersonalReportModel.findOne = jest.fn();

    const { next } = await call(Controller.approveReport, {
      user: userWithRole(ROLES.OQITUVCHI, TEACHER_ID),
    });

    expect(next.mock.calls[0][0].statusCode).toBe(403);
    expect(PersonalReportModel.findOne).not.toHaveBeenCalled();
  });

  test("🔴 SECURITY: begona rol (masalan kafedra_mudiri) — 403, DB so'rovi qilinmaydi", async () => {
    PersonalReportModel.findOne = jest.fn();

    const { next } = await call(Controller.approveReport, {
      user: userWithRole(ROLES.KAFEDRA_MUDIRI),
    });

    expect(next.mock.calls[0][0].statusCode).toBe(403);
    expect(PersonalReportModel.findOne).not.toHaveBeenCalled();
  });

  test("🔴 SECURITY: klient `body.step`ni spoof qilsa E'TIBORSIZ qoldiriladi", async () => {
    const doc = reportDoc({ status: "submitted" });
    mockFound(doc);

    const { res } = await call(Controller.approveReport, {
      user: userWithRole(ROLES.DEKAN),
      body: { step: "kotib" },
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(doc.approvals.find((s) => s.step === "dekan").status).toBe("approved");
    expect(doc.approvals.find((s) => s.step === "kotib").status).toBe("pending");
  });

  test("🔴 SECURITY: bosqich allaqachon approved — 400", async () => {
    const doc = reportDoc({ status: "submitted", approvals: buildApprovals({ dekan: "approved" }) });
    mockFound(doc);

    const { next } = await call(Controller.approveReport, { user: userWithRole(ROLES.DEKAN) });

    expect(next.mock.calls[0][0].statusCode).toBe(400);
  });

  test("`submitted` bo'lmagan holatdan tasdiqlab bo'lmaydi — 400", async () => {
    const doc = reportDoc({ status: "approved" });
    mockFound(doc);

    const { next } = await call(Controller.approveReport, { user: userWithRole(ROLES.DEKAN) });

    expect(next.mock.calls[0][0].statusCode).toBe(400);
  });

  test("2026-09-07: `draft` holatdan endi tasdiqlab bo'lmaydi — 400 (submit talab qilinadi)", async () => {
    const doc = reportDoc({ status: "draft" });
    mockFound(doc);

    const { next } = await call(Controller.approveReport, { user: userWithRole(ROLES.DEKAN) });

    expect(next.mock.calls[0][0].statusCode).toBe(400);
  });

  test("D-045b: `submitted` holatdagi hisobotga kotib ikkinchi imzoni qo'yadi — 200, `approved`ga o'tadi", async () => {
    const doc = reportDoc({ status: "submitted", approvals: buildApprovals({ dekan: "approved" }) });
    mockFound(doc);

    const { res } = await call(Controller.approveReport, {
      user: userWithRole(ROLES.FAKULTET_KENGASH_KOTIBI),
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(doc.status).toBe("approved");
    expect(doc.approvals.find((s) => s.step === "kotib").status).toBe("approved");
  });

  test("super_admin bypass — `body.step`siz 400, `step` bilan tasdiqlaydi", async () => {
    const doc = reportDoc({ status: "submitted" });
    mockFound(doc);

    const { next } = await call(Controller.approveReport, { user: userWithRole(ROLES.SUPER_ADMIN) });
    expect(next.mock.calls[0][0].statusCode).toBe(400);

    const { res } = await call(Controller.approveReport, {
      user: userWithRole(ROLES.SUPER_ADMIN),
      body: { step: "kotib" },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(doc.approvals.find((s) => s.step === "kotib").status).toBe("approved");
  });
});

describe("Rad etish — TZ 4.3.7/4.3.8", () => {
  test("dekan/kotib rad etsa — hisobot `rejected`ga o'tadi, `comment` yoziladi", async () => {
    const doc = reportDoc({ status: "submitted" });
    mockFound(doc);

    const { res } = await call(Controller.rejectReport, {
      user: userWithRole(ROLES.DEKAN),
      body: { comment: "Hisobot yetarli emas" },
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(doc.status).toBe("rejected");
    expect(doc.approvals.find((s) => s.step === "dekan").comment).toBe(
      "Hisobot yetarli emas",
    );
  });

  test("🔴 SECURITY: `oqituvchi` chaqirsa — 403, DB so'rovi qilinmaydi", async () => {
    PersonalReportModel.findOne = jest.fn();

    const { next } = await call(Controller.rejectReport, {
      user: userWithRole(ROLES.OQITUVCHI, TEACHER_ID),
      body: { comment: "x" },
    });

    expect(next.mock.calls[0][0].statusCode).toBe(403);
    expect(PersonalReportModel.findOne).not.toHaveBeenCalled();
  });

  test("`draft` bo'lmagan holatdan rad etib bo'lmaydi — 400", async () => {
    const doc = reportDoc({ status: "rejected" });
    mockFound(doc);

    const { next } = await call(Controller.rejectReport, {
      user: userWithRole(ROLES.DEKAN),
      body: { comment: "x" },
    });

    expect(next.mock.calls[0][0].statusCode).toBe(400);
  });

  test("D-045b: `submitted` holatdan rad etiladi — 200, status `rejected`", async () => {
    const doc = reportDoc({ status: "submitted", approvals: buildApprovals({ dekan: "approved" }) });
    mockFound(doc);

    const { res } = await call(Controller.rejectReport, {
      user: userWithRole(ROLES.FAKULTET_KENGASH_KOTIBI),
      body: { comment: "Kotib rad etdi" },
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(doc.status).toBe("rejected");
  });
});

describe("updateReport — PUT /:id (faqat draft/rejected)", () => {
  test("`draft` holatda tahrirlanadi", async () => {
    const doc = reportDoc({ status: "draft" });
    mockFound(doc);

    const { res } = await call(Controller.updateReport, { body: { text: "Yangilangan matn" } });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(doc.text).toBe("Yangilangan matn");
  });

  test("`approved` holatda tahrirlab bo'lmaydi — 400", async () => {
    const doc = reportDoc({ status: "approved" });
    mockFound(doc);

    const { next } = await call(Controller.updateReport, { body: { text: "x" } });

    expect(next.mock.calls[0][0].statusCode).toBe(400);
  });

  test("D-045b: `submitted` holatda tahrirlab bo'lmaydi — 400", async () => {
    const doc = reportDoc({ status: "submitted" });
    mockFound(doc);

    const { next } = await call(Controller.updateReport, { body: { text: "x" } });

    expect(next.mock.calls[0][0].statusCode).toBe(400);
  });

  test("`rejected` dan tahrirlansa — bosqichlar `pending`ga tozalanadi, holat `draft`", async () => {
    const approvals = buildApprovals({ dekan: "approved", kotib: "rejected" });
    approvals.find((s) => s.step === "kotib").comment = "eski sabab";
    const doc = reportDoc({ status: "rejected", approvals });
    mockFound(doc);

    const { res } = await call(Controller.updateReport, { body: { text: "Qayta yubordim" } });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(doc.status).toBe("draft");
    expect(doc.approvals.every((s) => s.status === "pending")).toBe(true);
    expect(doc.approvals.every((s) => s.comment === null)).toBe(true);
  });
});

describe("deleteReport — DELETE /:id (faqat draft/rejected)", () => {
  test("`draft` holatda o'chiriladi", async () => {
    mockFound(reportDoc({ status: "draft" }));
    PersonalReportModel.deleteOne = jest.fn().mockResolvedValue({});

    const { res } = await call(Controller.deleteReport);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(PersonalReportModel.deleteOne).toHaveBeenCalledWith({ _id: REPORT_ID });
  });

  test("`approved` holatda o'chirib bo'lmaydi — 400", async () => {
    mockFound(reportDoc({ status: "approved" }));
    PersonalReportModel.deleteOne = jest.fn();

    const { next } = await call(Controller.deleteReport);

    expect(next.mock.calls[0][0].statusCode).toBe(400);
    expect(PersonalReportModel.deleteOne).not.toHaveBeenCalled();
  });

  test("D-045b: `submitted` holatda o'chirib bo'lmaydi — 400", async () => {
    mockFound(reportDoc({ status: "submitted" }));
    PersonalReportModel.deleteOne = jest.fn();

    const { next } = await call(Controller.deleteReport);

    expect(next.mock.calls[0][0].statusCode).toBe(400);
    expect(PersonalReportModel.deleteOne).not.toHaveBeenCalled();
  });
});

describe("REGRESSION-GUARD — barcha `/:id` handlerlar scope bilan qidirsin (IDOR himoyasi)", () => {
  test("approveReport/rejectReport/updateReport/deleteReport — `findOne({_id, ...scope})` bilan", async () => {
    mockFound(reportDoc({ status: "draft" }));
    await call(Controller.updateReport, { body: { text: "x" } });
    expect(PersonalReportModel.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: REPORT_ID, teacher: SCOPE.teacher }),
    );
  });

  test("controller faylida `findById` umuman yo'q", () => {
    const fs = require("fs");
    const src = fs.readFileSync(require.resolve("./personalReport.controller"), "utf8");
    expect(src).not.toMatch(/PersonalReportModel\.findById/);
  });

  test("service faylida ham `findById` yo'q", () => {
    const fs = require("fs");
    const src = fs.readFileSync(require.resolve("./personalReport.service"), "utf8");
    expect(src).not.toMatch(/PersonalReportModel\.findById/);
  });
});

describe("addReport — D-29 takroriy hisobot", () => {
  test("shu reja+semestr uchun hisobot bor — 409, yangisi yaratilmaydi", async () => {
    mockPlanOwner(TEACHER_ID);
    PersonalReportModel.exists = jest.fn().mockResolvedValue({ _id: REPORT_ID });
    PersonalReportModel.mockImplementation(() => ({ save: jest.fn() }));

    const { next } = await call(Controller.addReport, {
      body: { plan: PLAN_ID, academicYear: "d", semester: 1, text: "x" },
    });

    const err = next.mock.calls[0][0];
    expect(err.statusCode || err.status).toBe(409);
    expect(PersonalReportModel).not.toHaveBeenCalled();
    expect(PersonalReportModel.exists).toHaveBeenCalledWith({
      plan: PLAN_ID,
      semester: 1,
      active: { $ne: false },
    });
  });
});
