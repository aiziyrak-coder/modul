jest.mock("./personalReport.model");
jest.mock("#modules/4.03-teacher/personalWorkPlan/personalWorkPlan.model");
jest.mock("#modules/4.01-auth/user/user.model");
jest.mock("#modules/4.01-auth/role/role.model");
jest.mock("#references/department/department.model");
jest.mock("#references/academicYear/academicYear.model");
jest.mock("#system/notification/notificationDispatcher", () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
}));

const PersonalReportModel = require("./personalReport.model");
const User = require("#modules/4.01-auth/user/user.model");
const Role = require("#modules/4.01-auth/role/role.model");
const Department = require("#references/department/department.model");
const AcademicYear = require("#references/academicYear/academicYear.model");
const { dispatch } = require("#system/notification/notificationDispatcher");
const service = require("./personalReport.service");
const { ROLES } = require("#config/constants");

const REPORT_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const PLAN_ID = "1111111111111111111111aa";
const TEACHER_ID = "cccccccccccccccccccccccc";
const DEPT_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const FACULTY_ID = "dddddddddddddddddddddddd";
const YEAR_ID = "eeeeeeeeeeeeeeeeeeeeeeee";
const SCOPE = {};

const roleId = (title) => `role-${title}`;
const userIdFor = (title) => `user-${title}`;

const chain = (result) => ({
  select: jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue(result),
  }),
});

const buildApprovals = (overrides = {}) =>
  [
    { step: "dekan", label: "Fakultet dekani" },
    { step: "kotib", label: "Fakultet ilmiy kengash kotibi" },
  ].map((s) => ({ ...s, status: overrides[s.step] || "pending" }));

const reportDoc = ({ status = "submitted", approvals } = {}) => ({
  _id: REPORT_ID,
  plan: PLAN_ID,
  teacher: TEACHER_ID,
  academicYear: YEAR_ID,
  semester: 1,
  status,
  approvals: approvals || buildApprovals(),
  save: jest.fn().mockResolvedValue(undefined),
});

const mockFound = (doc) => {
  PersonalReportModel.findOne = jest.fn().mockResolvedValue(doc);
};

const userWithRole = (title) => ({
  _id: title === ROLES.OQITUVCHI ? TEACHER_ID : `actor-${title}`,
  role: { title },
});

const dispatchedTo = () => dispatch.mock.calls.map((c) => c[0].userId).sort();
const firstPayload = () => dispatch.mock.calls[0][0];

beforeEach(() => {
  jest.clearAllMocks();

  Role.find = jest.fn((filter) =>
    chain((filter?.title?.$in || []).map((title) => ({ _id: roleId(title) }))),
  );
  User.find = jest.fn((filter) =>
    chain(
      (filter?.role?.$in || []).map((rid) => ({
        _id: userIdFor(String(rid).replace(/^role-/, "")),
      })),
    ),
  );
  User.findById = jest.fn(() => chain({ department: DEPT_ID, faculty: null }));
  Department.findById = jest.fn(() => chain({ faculty: FACULTY_ID }));
  Department.find = jest.fn(() => chain([{ _id: DEPT_ID }]));
  AcademicYear.findById = jest.fn(() => chain({ title: "2026/2027" }));
});

describe("submit() — dekan + kengash kotibi xabar oladi", () => {
  test("`personalReport_submitted` ikki qabul qiluvchiga, fakultet bo'yicha", async () => {
    const doc = reportDoc({ status: "draft" });
    mockFound(doc);

    await service.submit(REPORT_ID, userWithRole(ROLES.OQITUVCHI), SCOPE);

    expect(doc.status).toBe("submitted");
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatchedTo()).toEqual(
      [
        userIdFor(ROLES.DEKAN),
        userIdFor(ROLES.FAKULTET_KENGASH_KOTIBI),
      ].sort(),
    );
    expect(firstPayload()).toMatchObject({
      eventType: "personalReport_submitted",
      link: "/teacher/work-plans/reports",
      metadata: { reportId: REPORT_ID, planId: PLAN_ID },
    });
    expect(User.find).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: [{ faculty: FACULTY_ID }, { department: { $in: [DEPT_ID] } }],
      }),
    );
  });

  test("qabul qiluvchi topilmasa — 0 dispatch, hisobot baribir yuboriladi", async () => {
    Role.find = jest.fn(() => chain([]));
    const doc = reportDoc({ status: "draft" });
    mockFound(doc);

    await service.submit(REPORT_ID, userWithRole(ROLES.OQITUVCHI), SCOPE);

    expect(dispatch).not.toHaveBeenCalled();
    expect(doc.status).toBe("submitted");
  });
});

describe("approve() — faqat zanjir TO'LIQ tugaganda egasiga xabar", () => {
  test("1-imzo (oraliq) — dispatch YO'Q", async () => {
    const doc = reportDoc();
    mockFound(doc);

    await service.approve(REPORT_ID, userWithRole(ROLES.DEKAN), SCOPE, {});

    expect(doc.status).toBe("submitted");
    expect(dispatch).not.toHaveBeenCalled();
  });

  test("2-imzo — egasiga `personalReport_approved`, havola reja detaliga", async () => {
    const doc = reportDoc({ approvals: buildApprovals({ dekan: "approved" }) });
    mockFound(doc);

    await service.approve(
      REPORT_ID,
      userWithRole(ROLES.FAKULTET_KENGASH_KOTIBI),
      SCOPE,
      {},
    );

    expect(doc.status).toBe("approved");
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(firstPayload()).toMatchObject({
      userId: TEACHER_ID,
      eventType: "personalReport_approved",
      link: `/teacher/work-plans/${PLAN_ID}`,
      metadata: { reportId: REPORT_ID, planId: PLAN_ID },
    });
  });
});

describe("reject() — egasiga sabab bilan xabar", () => {
  test("`personalReport_rejected` + sabab matnda", async () => {
    const doc = reportDoc();
    mockFound(doc);

    await service.reject(REPORT_ID, userWithRole(ROLES.DEKAN), SCOPE, {
      comment: "Hisobot to'liq emas",
    });

    expect(doc.status).toBe("rejected");
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(firstPayload()).toMatchObject({
      userId: TEACHER_ID,
      eventType: "personalReport_rejected",
    });
    expect(firstPayload().body).toContain("Hisobot to'liq emas");
  });
});

describe("best-effort — bildirishnoma amalni BLOKLAMAYDI", () => {
  test("dispatch xato bersa reject baribir muvaffaqiyatli", async () => {
    dispatch.mockRejectedValue(new Error("socket down"));
    const doc = reportDoc();
    mockFound(doc);

    const { report } = await service.reject(
      REPORT_ID,
      userWithRole(ROLES.DEKAN),
      SCOPE,
      { comment: "sabab" },
    );

    expect(report.status).toBe("rejected");
    expect(doc.save).toHaveBeenCalledTimes(1);
  });

  test("qabul qiluvchi qidiruvi xato bersa submit baribir muvaffaqiyatli", async () => {
    Role.find = jest.fn(() => {
      throw new Error("connection lost");
    });
    const doc = reportDoc({ status: "draft" });
    mockFound(doc);

    await service.submit(REPORT_ID, userWithRole(ROLES.OQITUVCHI), SCOPE);

    expect(doc.status).toBe("submitted");
    expect(doc.save).toHaveBeenCalledTimes(1);
  });
});
