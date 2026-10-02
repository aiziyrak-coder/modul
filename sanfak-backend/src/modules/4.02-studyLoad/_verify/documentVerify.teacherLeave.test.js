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

const OTHER_MODELS = [
  require("#modules/4.02-studyLoad/workload/workload.model"),
  require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model"),
  require("#modules/4.02-studyLoad/syllabus/syllabus.model"),
  require("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model"),
  require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model"),
  require("#modules/4.02-studyLoad/workloadSummary/workloadSummary.model"),
  require("#modules/4.02-studyLoad/contingentReport/contingentReport.model"),
];
const TeacherLeaveModel = require("#modules/4.02-studyLoad/teacherLeave/teacherLeave.model");
const UserModel = require("#modules/4.01-auth/user/user.model");
const { issueToken, lookup } = require("./documentVerify.service");

const TOKEN = "c".repeat(32);
const approvalDate = new Date("2026-09-20T09:00:00Z");
const SNAPSHOT = [
  { step: "kafedra", label: "Kafedra mudiri", shortName: "B.Yusupov", date: approvalDate },
];
const mkQuery = (result) => ({
  populate: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(result),
});
const leaveDoc = (over = {}) => ({
  constructor: { modelName: "teacherLeave" },
  status: "approved",
  approvedBy: "u-head",
  approvalDate,
  verify: {},
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  for (const M of OTHER_MODELS) M.findOne = jest.fn().mockReturnValue(mkQuery(null));
  UserModel.find = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ _id: "u-head", firstName: "Botir", lastName: "Yusupov" }]),
    }),
  });
});

describe("issueToken — teacherLeave", () => {
  test("BITTA «Kafedra mudiri» bosqichi snapshot'ga tushadi", async () => {
    const doc = leaveDoc();
    await issueToken(doc, "u-head");
    expect(doc.verify.token).toMatch(/^[0-9a-f]{32}$/);
    expect(doc.verify.snapshot).toEqual(SNAPSHOT);
  });

  test("tasdiqlanmagan ariza — snapshot bo'sh (soxta imzo yo'q)", async () => {
    const doc = leaveDoc({ status: "pending", approvedBy: null });
    await issueToken(doc, "x");
    expect(doc.verify.snapshot).toEqual([]);
  });
});

describe("lookup — teacherLeave", () => {
  test("bitta bosqich; sarlavhada sabab/sana/id YO'Q", async () => {
    TeacherLeaveModel.findOne = jest.fn().mockReturnValue(
      mkQuery({
        _id: "leave-1",
        status: "approved",
        type: "resignation",
        reason: "MAXFIY-SABAB",
        fromDate: new Date("2026-10-01"),
        toDate: new Date("2026-11-01"),
        teacher: { firstName: "Odiljon", lastName: "Umirzakov" },
        verify: { token: TOKEN, revokedAt: null, issuedAt: approvalDate, snapshot: SNAPSHOT },
      }),
    );
    const result = await lookup(TOKEN);
    expect(result).toEqual({
      kind: "teacherLeave",
      title: "O'qituvchi arizasi bayonnomasi — O.Umirzakov",
      approvedAt: approvalDate,
      snapshot: SNAPSHOT,
      editedAfterApproval: false,
    });
    const json = JSON.stringify(result);
    for (const leak of ["MAXFIY-SABAB", "leave-1", "2026-10-01", "Ishdan bo'shash"]) expect(json).not.toContain(leak);
  });

  test("bekor qilingan token — null (Topilmadi)", async () => {
    TeacherLeaveModel.findOne = jest.fn().mockReturnValue(
      mkQuery({
        status: "approved",
        type: "leave",
        teacher: { firstName: "A", lastName: "B" },
        verify: { token: TOKEN, revokedAt: new Date(), snapshot: [] },
      }),
    );
    expect(await lookup(TOKEN)).toBeNull();
  });
});
