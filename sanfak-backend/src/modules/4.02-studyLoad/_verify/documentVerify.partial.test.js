"use strict";

jest.mock("#modules/4.02-studyLoad/workload/workload.model");
jest.mock("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
jest.mock("#modules/4.02-studyLoad/syllabus/syllabus.model");
jest.mock("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");
jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
jest.mock("#modules/4.02-studyLoad/workloadSummary/workloadSummary.model");
jest.mock("#modules/4.02-studyLoad/contingentReport/contingentReport.model");
jest.mock("#modules/4.02-studyLoad/teacherLeave/teacherLeave.model");
jest.mock("#modules/4.01-auth/user/user.model");
jest.mock("#references/_services/academicYearResolver", () => ({
  getAcademicYearTitle: jest.fn().mockResolvedValue("2026/2027"),
}));
jest.mock("#shared/winston.logger", () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));

const WorkloadModel = require("#modules/4.02-studyLoad/workload/workload.model");
const WorkloadDistributionModel = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const SyllabusModel = require("#modules/4.02-studyLoad/syllabus/syllabus.model");
const ScienceProgramModel = require("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const WorkloadSummaryModel = require("#modules/4.02-studyLoad/workloadSummary/workloadSummary.model");
const ContingentReportModel = require("#modules/4.02-studyLoad/contingentReport/contingentReport.model");
const TeacherLeaveModel = require("#modules/4.02-studyLoad/teacherLeave/teacherLeave.model");
const UserModel = require("#modules/4.01-auth/user/user.model");
const { REGISTRY, issueOrRefresh, revoke, lookup } = require("./documentVerify.service");

const USERS = [
  { _id: "u-m", firstName: "Nilufar", lastName: "Rahimova" },
  { _id: "u-d", firstName: "Dilshod", lastName: "Rahmonov" },
];
const D1 = new Date(2026, 8, 20);
const D2 = new Date(2026, 8, 22);

const mockUsers = () => {
  UserModel.find = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(USERS) }),
  });
};
const wsDoc = (history) => ({
  constructor: { modelName: "workingSchedule" },
  approvalHistory: history,
  verify: {},
});
const step = (name, status, approvedBy = null, date = null) => ({ step: name, status, approvedBy, date });

beforeEach(() => {
  jest.clearAllMocks();
  mockUsers();
});

describe("issueOrRefresh — bitta hujjat, bitta token", () => {
  test("birinchi chaqiruv — token chiqaradi, snapshot O'UB bilan", async () => {
    const doc = wsDoc([step("methodical", "approved", "u-m", D1), step("dean", "pending")]);
    const token = await issueOrRefresh(doc, "u-m");
    expect(token).toMatch(/^[0-9a-f]{32}$/);
    expect(doc.verify.token).toBe(token);
    expect(doc.verify.snapshot.map((s) => s.step)).toEqual(["methodical"]);
  });

  test("ikkinchi chaqiruv — token O'ZGARMAYDI, snapshot yangilanadi (dekan qo'shiladi)", async () => {
    const doc = wsDoc([step("methodical", "approved", "u-m", D1), step("dean", "pending")]);
    const first = await issueOrRefresh(doc, "u-m");
    const issuedAt = doc.verify.issuedAt;
    doc.approvalHistory[1] = step("dean", "approved", "u-d", D2);
    const second = await issueOrRefresh(doc, "u-d");
    expect(second).toBe(first);
    expect(doc.verify.issuedAt).toBe(issuedAt);
    expect(doc.verify.snapshot.map((s) => s.shortName)).toEqual(["N.Rahimova", "D.Rahmonov"]);
  });

  test("revoke'dan keyin — YANGI token (qayta yuborish)", async () => {
    const doc = wsDoc([step("methodical", "approved", "u-m", D1)]);
    const first = await issueOrRefresh(doc, "u-m");
    revoke(doc, "Rad etildi");
    const second = await issueOrRefresh(doc, "u-m");
    expect(second).toMatch(/^[0-9a-f]{32}$/);
    expect(second).not.toBe(first);
    expect(doc.verify.revokedAt).toBeNull();
  });

  test("ichki xato — throw yo'q, null", async () => {
    UserModel.find = jest.fn(() => {
      throw new Error("db");
    });
    const doc = wsDoc([step("methodical", "approved", "u-m", D1)]);
    doc.verify = { token: "a".repeat(32), revokedAt: null, snapshot: [] };
    await expect(issueOrRefresh(doc, "x")).resolves.toBeNull();
  });
});

const mkQuery = (result) => ({
  populate: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(result),
});
const onlyWorkingSchedule = (wsResult) => {
  for (const M of [WorkloadModel, WorkloadDistributionModel, SyllabusModel, ScienceProgramModel,
    WorkloadSummaryModel, ContingentReportModel, TeacherLeaveModel]) {
    M.findOne = jest.fn().mockReturnValue(mkQuery(null));
  }
  WorkingScheduleModel.findOne = jest.fn().mockReturnValue(mkQuery(wsResult));
};
const TOKEN = "f".repeat(32);
const leanWs = (status, history, verify = {}) => ({
  status,
  direction: { title: "Davolash ishi", directionCode: "60910200" },
  academicYear: "y1",
  stage: "I",
  approvalHistory: history,
  verify: {
    token: TOKEN,
    revokedAt: null,
    issuedAt: new Date(2020, 0, 1),
    snapshot: [{ step: "methodical", label: "O'UB", shortName: "N.Rahimova", date: D1 }],
    ...verify,
  },
});

describe("lookup — partialVerify (workingSchedule)", () => {
  test("REGISTRY: faqat workingSchedule partialVerify", () => {
    expect(REGISTRY.filter((r) => r.partialVerify).map((r) => r.kind)).toEqual(["workingSchedule"]);
  });

  test("in_review → state in_progress, pending faqat step+label, approvedAt = oxirgi imzo (issuedAt EMAS)", async () => {
    onlyWorkingSchedule(
      leanWs("in_review", [
        { ...step("methodical", "approved", "u-m", D1), comment: "maxfiy", eriSignature: "SIG" },
        step("dean", "pending"),
      ]),
    );
    const r = await lookup(TOKEN);
    expect(r.state).toBe("in_progress");
    expect(r.approvedAt).toEqual(D1);
    expect(r.pending).toEqual([{ step: "dean", label: "Fakultet dekani" }]);
    expect(JSON.stringify(r)).not.toMatch(/maxfiy|SIG|eriSignature|comment/);
  });

  test("approved → state approved, approvedAt = yakuniy bosqich sanasi", async () => {
    onlyWorkingSchedule(
      leanWs("approved", [step("methodical", "approved", "u-m", D1), step("rektor", "approved", "u-r", D2)]),
    );
    const r = await lookup(TOKEN);
    expect(r.state).toBe("approved");
    expect(r.approvedAt).toEqual(D2);
    expect(r.pending).toBeUndefined();
  });

  test.each([
    ["rejected", {}],
    ["draft", {}],
    ["in_review", { revokedAt: new Date() }],
    ["approved", { revokedAt: new Date() }],
  ])("%s (%o) → null (Topilmadi)", async (status, verify) => {
    onlyWorkingSchedule(leanWs(status, [step("methodical", "approved", "u-m", D1)], verify));
    expect(await lookup(TOKEN)).toBeNull();
  });

  test("boshqa kind (workload) in_review → null (o'zgarmagan)", async () => {
    onlyWorkingSchedule(null);
    WorkloadModel.findOne = jest.fn().mockReturnValue(
      mkQuery({ status: "in_review", verify: { token: TOKEN, snapshot: [] } }),
    );
    expect(await lookup(TOKEN)).toBeNull();
  });
});
