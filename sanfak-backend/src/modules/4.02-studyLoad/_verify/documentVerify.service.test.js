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
jest.mock("#shared/winston.logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}));

const WorkloadModel = require("#modules/4.02-studyLoad/workload/workload.model");
const WorkloadDistributionModel = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const SyllabusModel = require("#modules/4.02-studyLoad/syllabus/syllabus.model");
const ScienceProgramModel = require("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const WorkloadSummaryModel = require("#modules/4.02-studyLoad/workloadSummary/workloadSummary.model");
const ContingentReportModel = require("#modules/4.02-studyLoad/contingentReport/contingentReport.model");
const TeacherLeaveModel = require("#modules/4.02-studyLoad/teacherLeave/teacherLeave.model");
const UserModel = require("#modules/4.01-auth/user/user.model");
const winston = require("#shared/winston.logger");
const {
  REGISTRY,
  issueToken,
  revoke,
  lookup,
} = require("./documentVerify.service");

function makeWorkloadDoc(overrides = {}) {
  return {
    constructor: { modelName: "workload" },
    approvalSteps: [],
    verify: {},
    ...overrides,
  };
}

function makeDistributionDoc(overrides = {}) {
  return {
    constructor: { modelName: "workloadDistribution" },
    approvalSteps: [],
    verify: {},
    ...overrides,
  };
}

function makeSyllabusDoc(overrides = {}) {
  return {
    constructor: { modelName: "syllabus" },
    approvalSteps: [],
    verify: {},
    ...overrides,
  };
}

function makeScienceProgramDoc(overrides = {}) {
  return {
    constructor: { modelName: "scienceProgram" },
    approvalSteps: [],
    verify: {},
    ...overrides,
  };
}

function makeWorkingScheduleDoc(overrides = {}) {
  return {
    constructor: { modelName: "workingSchedule" },
    approvalHistory: [],
    verify: {},
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("issueToken", () => {
  test("32 hex token yaratadi (crypto — Math.random EMAS, formatdan tekshiriladi)", async () => {
    UserModel.find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
    });
    const doc = makeWorkloadDoc();
    const token = await issueToken(doc, "user-1");
    expect(token).toMatch(/^[0-9a-f]{32}$/);
    expect(doc.verify.token).toBe(token);
    expect(doc.verify.issuedBy).toBe("user-1");
    expect(doc.verify.revokedAt).toBeNull();
    expect(doc.verify.issuedAt).toBeInstanceOf(Date);
  });

  test("ikki marta chaqirilsa — YANGI token (eski qiymat qoladi emas)", async () => {
    UserModel.find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
    });
    const doc = makeWorkloadDoc();
    const t1 = await issueToken(doc, "u1");
    const t2 = await issueToken(doc, "u1");
    expect(t1).not.toBe(t2);
    expect(doc.verify.token).toBe(t2);
  });

  test("snapshot faqat status==='approved' bosqichlardan quriladi, label+shortName+date bilan", async () => {
    UserModel.find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: "u-rektor", firstName: "Ravshan", lastName: "Aliyev" },
        ]),
      }),
    });
    const approvedDate = new Date("2026-09-03");
    const doc = makeWorkloadDoc({
      approvalSteps: [
        { step: "methodical", status: "pending" },
        { step: "rektor", status: "approved", approvedBy: "u-rektor", date: approvedDate },
      ],
    });
    await issueToken(doc, "actor");
    expect(doc.verify.snapshot).toEqual([
      { step: "rektor", label: "Farg'ona jamoat salomatligi tibbiyot instituti rektori", shortName: "R.Aliyev", date: approvedDate },
    ]);
  });

  test("ichki xato throw qilmaydi — null qaytadi, winston.error yoziladi", async () => {
    UserModel.find = jest.fn().mockImplementation(() => {
      throw new Error("db xato");
    });
    const doc = makeWorkloadDoc({
      approvalSteps: [{ step: "rektor", status: "approved", approvedBy: "u1", date: new Date() }],
    });
    const token = await expect(issueToken(doc, "actor")).resolves.toBeNull();
    expect(winston.error).toHaveBeenCalled();
    void token;
  });
});

describe("revoke", () => {
  test("faol token bo'lsa — revokedAt + reason yoziladi, TOKEN O'CHIRILMAYDI", () => {
    const doc = makeWorkloadDoc({ verify: { token: "abc123", revokedAt: null } });
    revoke(doc, "Qayta ochildi");
    expect(doc.verify.token).toBe("abc123");
    expect(doc.verify.revokedAt).toBeInstanceOf(Date);
    expect(doc.verify.revokedReason).toBe("Qayta ochildi");
  });

  test("faol token yo'q — no-op", () => {
    const doc = makeWorkloadDoc({ verify: {} });
    revoke(doc, "sabab");
    expect(doc.verify.revokedAt).toBeUndefined();
  });

  test("doc.verify umuman yo'q — throw qilmaydi", () => {
    const doc = { constructor: { modelName: "workload" } };
    expect(() => revoke(doc, "sabab")).not.toThrow();
  });
});

describe("lookup — SHART #8: 3 holat ham bir xil (null)", () => {
  const mkQuery = (result) => ({
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
  });

  beforeEach(() => {
    WorkloadDistributionModel.findOne = jest.fn().mockReturnValue(mkQuery(null));
    SyllabusModel.findOne = jest.fn().mockReturnValue(mkQuery(null));
    ScienceProgramModel.findOne = jest.fn().mockReturnValue(mkQuery(null));
    WorkingScheduleModel.findOne = jest.fn().mockReturnValue(mkQuery(null));
    WorkloadSummaryModel.findOne = jest.fn().mockReturnValue(mkQuery(null));
    ContingentReportModel.findOne = jest.fn().mockReturnValue(mkQuery(null));
    TeacherLeaveModel.findOne = jest.fn().mockReturnValue(mkQuery(null));
  });

  test("format noto'g'ri (32 hex emas) — Model'ga so'rov YUBORILMAYDI", async () => {
    WorkloadModel.findOne = jest.fn();
    const result = await lookup("qisqa-token");
    expect(result).toBeNull();
    expect(WorkloadModel.findOne).not.toHaveBeenCalled();
  });

  test("topilmadi — null", async () => {
    WorkloadModel.findOne = jest.fn().mockReturnValue(mkQuery(null));
    const result = await lookup("a".repeat(32));
    expect(result).toBeNull();
  });

  test("status !== 'approved' — null", async () => {
    WorkloadModel.findOne = jest.fn().mockReturnValue(
      mkQuery({ status: "in_review", verify: { token: "a".repeat(32), snapshot: [] } }),
    );
    const result = await lookup("a".repeat(32));
    expect(result).toBeNull();
  });

  test("bekor qilingan (revokedAt bor) — null", async () => {
    WorkloadModel.findOne = jest.fn().mockReturnValue(
      mkQuery({
        status: "approved",
        verify: { token: "a".repeat(32), revokedAt: new Date(), snapshot: [] },
      }),
    );
    const result = await lookup("a".repeat(32));
    expect(result).toBeNull();
  });

  test("yaroqli — allowlist shaklida qaytadi (B4: ESKI, probelli shortName ham QAYTA formatlanmasdan chiqadi — `lookup()` `personName()` ni umuman chaqirmaydi)", async () => {
    const issuedAt = new Date("2026-09-01");
    WorkloadModel.findOne = jest.fn().mockReturnValue(
      mkQuery({
        _id: "wl-1",
        status: "approved",
        department: { title: "Ichki kasalliklar" },
        academicYear: "year-1",
        lastEditedAfterApprovalAt: null,
        verify: {
          token: "a".repeat(32),
          revokedAt: null,
          issuedAt,
          snapshot: [{ step: "rektor", label: "Rektor", shortName: "R. Aliyev", date: issuedAt }],
        },
      }),
    );
    const result = await lookup("a".repeat(32));
    expect(result).toEqual({
      kind: "workload",
      title: expect.stringContaining("Ichki kasalliklar"),
      approvedAt: issuedAt,
      snapshot: [{ step: "rektor", label: "Rektor", shortName: "R. Aliyev", date: issuedAt }],
      editedAfterApproval: false,
    });
  });

  test("lastEditedAfterApprovalAt bor — editedAfterApproval:true", async () => {
    WorkloadModel.findOne = jest.fn().mockReturnValue(
      mkQuery({
        status: "approved",
        department: {},
        academicYear: null,
        lastEditedAfterApprovalAt: new Date(),
        verify: { token: "a".repeat(32), revokedAt: null, snapshot: [] },
      }),
    );
    const result = await lookup("a".repeat(32));
    expect(result.editedAfterApproval).toBe(true);
  });

  test("model.findOne xato bersa — throw qilmaydi, null qaytadi", async () => {
    WorkloadModel.findOne = jest.fn().mockImplementation(() => {
      throw new Error("mongo xato");
    });
    const result = await lookup("a".repeat(32));
    expect(result).toBeNull();
  });

  test("workloadDistribution kolleksiyasidagi tokenni topadi (workload'da yo'q)", async () => {
    WorkloadModel.findOne = jest.fn().mockReturnValue(mkQuery(null));
    WorkloadDistributionModel.findOne = jest.fn().mockReturnValue(
      mkQuery({
        status: "approved",
        department: { title: "Stomatologiya" },
        academicYear: "year-1",
        lastEditedAfterApprovalAt: null,
        verify: { token: "b".repeat(32), revokedAt: null, issuedAt: new Date(), snapshot: [] },
      }),
    );
    const result = await lookup("b".repeat(32));
    expect(result.kind).toBe("workloadDistribution");
    expect(result.title).toEqual(expect.stringContaining("Stomatologiya"));
  });

  test("syllabus kolleksiyasidagi tokenni topadi — title PII/soat/moliya YO'Q", async () => {
    WorkloadModel.findOne = jest.fn().mockReturnValue(mkQuery(null));
    WorkloadDistributionModel.findOne = jest.fn().mockReturnValue(mkQuery(null));
    SyllabusModel.findOne = jest.fn().mockReturnValue(
      mkQuery({
        status: "approved",
        science: { title: "Mehnat gigiyenasi" },
        year: 2026,
        lastEditedAfterApprovalAt: null,
        verify: { token: "c".repeat(32), revokedAt: null, issuedAt: new Date(), snapshot: [] },
      }),
    );
    const result = await lookup("c".repeat(32));
    expect(result.kind).toBe("syllabus");
    expect(result.title).toBe("Mehnat gigiyenasi — 2026-yil sillabusi");
  });

  test("scienceProgram kolleksiyasidagi tokenni topadi — title formVersion bilan", async () => {
    WorkloadModel.findOne = jest.fn().mockReturnValue(mkQuery(null));
    WorkloadDistributionModel.findOne = jest.fn().mockReturnValue(mkQuery(null));
    SyllabusModel.findOne = jest.fn().mockReturnValue(mkQuery(null));
    ScienceProgramModel.findOne = jest.fn().mockReturnValue(
      mkQuery({
        status: "approved",
        science: { title: "Kommunal gigiyena" },
        formVersion: "v142",
        lastEditedAfterApprovalAt: null,
        verify: { token: "d".repeat(32), revokedAt: null, issuedAt: new Date(), snapshot: [] },
      }),
    );
    const result = await lookup("d".repeat(32));
    expect(result.kind).toBe("scienceProgram");
    expect(result.title).toBe("Kommunal gigiyena — 142-son fan dasturi");
  });

  test("workingSchedule kolleksiyasidagi tokenni topadi — title yo'nalish kodi bilan, moliya/soat YO'Q", async () => {
    WorkloadModel.findOne = jest.fn().mockReturnValue(mkQuery(null));
    WorkloadDistributionModel.findOne = jest.fn().mockReturnValue(mkQuery(null));
    SyllabusModel.findOne = jest.fn().mockReturnValue(mkQuery(null));
    ScienceProgramModel.findOne = jest.fn().mockReturnValue(mkQuery(null));
    WorkingScheduleModel.findOne = jest.fn().mockReturnValue(
      mkQuery({
        status: "approved",
        direction: { title: "Davolash ishi", directionCode: "60910200" },
        academicYear: "year-1",
        stage: "I",
        lastEditedAfterApprovalAt: null,
        verify: { token: "e".repeat(32), revokedAt: null, issuedAt: new Date(), snapshot: [] },
      }),
    );
    const result = await lookup("e".repeat(32));
    expect(result.kind).toBe("workingSchedule");
    expect(result.title).toBe(
      '60910200 – "Davolash ishi" — 2026/2027 o\'quv yili, I bosqich ishchi o\'quv rejasi',
    );
  });
});

describe("REGISTRY — WP-B Faza 2 + B2-3 + ADR-031 + ADR-036 (7 kind)", () => {
  test("REGISTRY aynan 7 kind, tartibi bilan", () => {
    expect(REGISTRY.map((r) => r.kind)).toEqual([
      "workload",
      "workloadDistribution",
      "syllabus",
      "scienceProgram",
      "workingSchedule",
      "workloadSummary",
      "contingentReport",
      "teacherLeave",
    ]);
  });

  test.each([
    ["workload", makeWorkloadDoc()],
    ["workloadDistribution", makeDistributionDoc()],
    ["syllabus", makeSyllabusDoc()],
    ["scienceProgram", makeScienceProgramDoc()],
  ])("issueToken — doc.constructor.modelName '%s' to'g'ri REGISTRY yozuvini topadi (label to'g'ri)", async (kind, doc) => {
    UserModel.find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: "u-kafedra", firstName: "Botir", lastName: "Yusupov" },
        ]),
      }),
    });
    doc.approvalSteps = [
      { step: "kafedra", status: "approved", approvedBy: "u-kafedra", date: new Date() },
    ];
    await issueToken(doc, "actor");
    expect(doc.verify.token).toMatch(/^[0-9a-f]{32}$/);
    expect(doc.verify.snapshot[0].label).toBe("Kafedra mudiri");
  });

  test("issueToken — workingSchedule: snapshot `approvalHistory`dan quriladi (`approvalSteps` YO'Q, stepsPath ishlaydi)", async () => {
    UserModel.find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: "u-rektor", firstName: "Ravshan", lastName: "Aliyev" },
        ]),
      }),
    });
    const doc = makeWorkingScheduleDoc({
      approvalHistory: [
        { step: "rektor", status: "approved", approvedBy: "u-rektor", date: new Date(2026, 8, 3) },
      ],
    });
    await issueToken(doc, "actor");
    expect(doc.verify.token).toMatch(/^[0-9a-f]{32}$/);
    expect(doc.verify.snapshot).toHaveLength(1);
    expect(doc.verify.snapshot[0]).toMatchObject({
      step: "rektor",
      label: "Farg'ona jamoat salomatligi tibbiyot instituti rektori",
      shortName: "R.Aliyev",
    });
  });

  test("buildSnapshot — mavjud 4 kind xulqi BAYT-BAYT o'zgarmagan (default stepsPath='approvalSteps')", async () => {
    UserModel.find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: "u1", firstName: "Anvar", lastName: "Nodirov" },
        ]),
      }),
    });
    const doc = makeWorkloadDoc({
      approvalSteps: [
        { step: "kafedra", status: "approved", approvedBy: "u1", date: new Date() },
      ],
      approvalHistory: [
        { step: "kafedra", status: "approved", approvedBy: "boshqa", date: new Date() },
      ],
    });
    await issueToken(doc, "actor");
    expect(doc.verify.snapshot[0].shortName).toBe("A.Nodirov");
  });
});
