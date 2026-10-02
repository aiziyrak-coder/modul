"use strict";

jest.mock("#modules/4.02-studyLoad/workload/workload.model");
jest.mock("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
jest.mock("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");
jest.mock("#modules/4.02-studyLoad/syllabus/syllabus.model");
jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
jest.mock("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
jest.mock("#modules/4.02-studyLoad/workloadSummary/workloadSummary.model");
jest.mock("#modules/4.02-studyLoad/contingentReport/contingentReport.model");
jest.mock("#modules/4.02-studyLoad/contingentReport/contingentReport.scope", () =>
  jest.fn(() => (req, res, next) => {
    req.scope = req.user?.__scope ?? {};
    next();
  }),
);

jest.mock("#modules/4.02-studyLoad/workload/workload.scope", () =>
  jest.fn(() => (req, res, next) => {
    req.scope = req.user?.__scope ?? {};
    next();
  }),
);
jest.mock("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.scope", () =>
  jest.fn(() => (req, res, next) => {
    req.scope = req.user?.__scope ?? {};
    next();
  }),
);
jest.mock("#modules/4.02-studyLoad/scienceProgram/scienceProgram.scope", () =>
  jest.fn(() => (req, res, next) => {
    req.scope = req.user?.__scope ?? {};
    next();
  }),
);
jest.mock("#modules/4.02-studyLoad/syllabus/syllabus.scope", () =>
  jest.fn(() => (req, res, next) => {
    req.scope = req.user?.__scope ?? {};
    next();
  }),
);
jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.scope", () =>
  jest.fn(() => (req, res, next) => {
    req.scope = req.user?.__scope ?? {};
    next();
  }),
);

const WorkloadModel = require("#modules/4.02-studyLoad/workload/workload.model");
const WorkloadDistributionModel = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const ScienceProgramModel = require("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");
const SyllabusModel = require("#modules/4.02-studyLoad/syllabus/syllabus.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const WorkloadSummaryModel = require("#modules/4.02-studyLoad/workloadSummary/workloadSummary.model");
const ContingentReportModel = require("#modules/4.02-studyLoad/contingentReport/contingentReport.model");
const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const { workingPlanYearTotals } = require("#modules/4.02-studyLoad/_pdf/workingPlan.pdf");

const Controller = require("./approvalInbox.controller");
const { ROLES } = require("#config/constants");

function matchesFilter(doc, filter) {
  return Object.entries(filter).every(([key, cond]) => {
    if (cond && typeof cond === "object" && !Array.isArray(cond)) {
      if ("$in" in cond) {
        const val = doc[key];
        return cond.$in.some((v) => String(v) === String(val));
      }
      if ("$elemMatch" in cond) {
        const arr = doc[key] || [];
        const { step, status } = cond.$elemMatch;
        return arr.some((item) => {
          const stepOk = step?.$in ? step.$in.includes(item.step) : item.step === step;
          const statusOk = !status || item.status === status;
          return stepOk && statusOk;
        });
      }
      return false;
    }
    if (doc[key] && typeof doc[key] === "object" && doc[key]._id) {
      return String(doc[key]._id) === String(cond);
    }
    return doc[key] === cond;
  });
}

function makeQuery(docs) {
  const q = {};
  q.select = jest.fn().mockReturnValue(q);
  q.populate = jest.fn().mockReturnValue(q);
  q.lean = jest.fn().mockReturnValue(q);
  q.exec = jest.fn().mockResolvedValue(docs);
  return q;
}

function wireModel(Model, docs) {
  Model.find = jest.fn((filter) => makeQuery(docs.filter((d) => matchesFilter(d, filter))));
  return Model.find;
}

const DEPT_ID = "dddddddddddddddddddddddd";
const AY_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";

const createReq = (query, user) => ({ query: query || {}, user });
const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /approval-inbox — approvalInbox.controller.list", () => {
  test("rol mos kelmasa — hujjat qaytmaydi (bo'sh massiv)", async () => {
    wireModel(WorkloadModel, [
      {
        _id: "1",
        title: "Yuklama 1",
        status: "in_review",
        active: true,
        approvalSteps: [
          { step: "methodical", status: "approved", date: new Date("2026-01-01") },
          { step: "kafedra", status: "pending" },
        ],
        updatedAt: new Date(),
      },
    ]);

    const user = { _id: "u1", role: { title: ROLES.ARM } };
    const req = createReq({ entity: "workload" }, user);
    const res = createRes();
    await Controller.list(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0]).toEqual([]);
    expect(WorkloadModel.find).not.toHaveBeenCalled();
  });

  test("rol mos kelsa va joriy bosqich bo'lsa — hujjat qaytadi", async () => {
    wireModel(WorkloadModel, [
      {
        _id: "1",
        title: "Yuklama 1",
        status: "in_review",
        active: true,
        department: { _id: DEPT_ID, title: "Terapevtik stomatologiya" },
        academicYear: { _id: AY_ID, title: "2025-2026" },
        directions: [
          { blocks: [{ totalHour: 150 }, { totalHour: 168 }] },
          { blocks: [{ totalHour: 300 }] },
        ],
        approvalSteps: [
          { step: "methodical", status: "approved", date: new Date("2026-01-01T10:00:00Z") },
          { step: "kafedra", status: "pending" },
          { step: "financial", status: "pending" },
          { step: "prorektor", status: "pending" },
          { step: "rektor", status: "pending" },
        ],
        updatedAt: new Date("2026-01-02T10:00:00Z"),
      },
    ]);

    const user = { _id: "u1", role: { title: ROLES.KAFEDRA_MUDIRI }, __scope: { department: DEPT_ID } };
    const req = createReq({ entity: "workload" }, user);
    const res = createRes();
    await Controller.list(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    const items = res.json.mock.calls[0][0];
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      entity: "workload",
      id: "1",
      title: "Yuklama 1",
      step: "kafedra",
      department: { _id: DEPT_ID, title: "Terapevtik stomatologiya" },
      academicYear: { _id: AY_ID, title: "2025-2026" },
      totalHour: 618,
    });
    expect(items[0].submittedAt).toEqual(new Date("2026-01-01T10:00:00Z"));
  });

  test("status !== 'in_review' — qaytmaydi", async () => {
    wireModel(WorkloadModel, [
      {
        _id: "2",
        title: "Draft yuklama",
        status: "draft",
        active: true,
        approvalSteps: [
          { step: "methodical", status: "pending" },
          { step: "kafedra", status: "pending" },
        ],
        updatedAt: new Date(),
      },
    ]);

    const user = { _id: "u1", role: { title: ROLES.OQUV_USLUBIY_BOSHQARMA } };
    const req = createReq({ entity: "workload" }, user);
    const res = createRes();
    await Controller.list(req, res, jest.fn());

    expect(res.json.mock.calls[0][0]).toEqual([]);
  });

  test("REGRESSION: rolga mos qadam bor, lekin u joriy emas (oldinda boshqa pending bor) — qaytmaydi", async () => {
    wireModel(WorkloadModel, [
      {
        _id: "3",
        title: "Yuklama 3",
        status: "in_review",
        active: true,
        approvalSteps: [
          { step: "methodical", status: "pending" },
          { step: "kafedra", status: "pending" },
          { step: "financial", status: "pending" },
          { step: "prorektor", status: "pending" },
          { step: "rektor", status: "pending" },
        ],
        updatedAt: new Date(),
      },
    ]);

    const user = { _id: "u1", role: { title: ROLES.KAFEDRA_MUDIRI } };
    const req = createReq({ entity: "workload" }, user);
    const res = createRes();
    await Controller.list(req, res, jest.fn());

    expect(res.json.mock.calls[0][0]).toEqual([]);
  });

  test("tasdiqlash roli bo'lmagan foydalanuvchi — bo'sh massiv (barcha 5 entity)", async () => {
    wireModel(WorkloadModel, []);
    wireModel(WorkloadDistributionModel, []);
    wireModel(ScienceProgramModel, []);
    wireModel(SyllabusModel, []);
    wireModel(WorkingScheduleModel, []);

    const user = { _id: "u1", role: { title: ROLES.TALABA } };
    const req = createReq({}, user);
    const res = createRes();
    await Controller.list(req, res, jest.fn());

    expect(res.json.mock.calls[0][0]).toEqual([]);
    expect(WorkloadModel.find).not.toHaveBeenCalled();
    expect(WorkloadDistributionModel.find).not.toHaveBeenCalled();
    expect(ScienceProgramModel.find).not.toHaveBeenCalled();
    expect(SyllabusModel.find).not.toHaveBeenCalled();
    expect(WorkingScheduleModel.find).not.toHaveBeenCalled();
  });

  test("entity= filtri ishlaydi — faqat so'ralgan entity so'raladi", async () => {
    wireModel(SyllabusModel, [
      {
        _id: "s1",
        title: "Sillabus 1",
        status: "in_review",
        active: true,
        approvalSteps: [{ step: "kafedra", status: "pending" }],
        updatedAt: new Date(),
      },
    ]);
    wireModel(WorkloadModel, []);
    wireModel(WorkloadDistributionModel, []);
    wireModel(ScienceProgramModel, []);
    wireModel(WorkingScheduleModel, []);

    const user = { _id: "u1", role: { title: ROLES.KAFEDRA_MUDIRI } };
    const req = createReq({ entity: "syllabus" }, user);
    const res = createRes();
    await Controller.list(req, res, jest.fn());

    const items = res.json.mock.calls[0][0];
    expect(items).toHaveLength(1);
    expect(items[0].entity).toBe("syllabus");

    expect(SyllabusModel.find).toHaveBeenCalledTimes(1);
    expect(WorkloadModel.find).not.toHaveBeenCalled();
    expect(WorkloadDistributionModel.find).not.toHaveBeenCalled();
    expect(ScienceProgramModel.find).not.toHaveBeenCalled();
    expect(WorkingScheduleModel.find).not.toHaveBeenCalled();
  });

  test("sillabus — 'dean' bosqichidagi hujjat dekan inbox'ida ko'rinadi", async () => {
    wireModel(SyllabusModel, [
      {
        _id: "s3",
        title: "Sillabus 3",
        status: "in_review",
        active: true,
        approvalSteps: [
          { step: "kafedra", status: "approved" },
          { step: "arm", status: "approved" },
          { step: "methodical", status: "approved" },
          { step: "dean", status: "pending" },
          { step: "prorektor", status: "pending" },
        ],
        updatedAt: new Date(),
      },
    ]);

    const user = { _id: "u1", role: { title: ROLES.DEKAN } };
    const req = createReq({ entity: "syllabus" }, user);
    const res = createRes();
    await Controller.list(req, res, jest.fn());

    const items = res.json.mock.calls[0][0];
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ entity: "syllabus", id: "s3", step: "dean" });
  });

  test("scienceProgram (v142) — 'dean' bosqichidagi hujjat dekan inbox'ida ko'rinadi", async () => {
    wireModel(ScienceProgramModel, [
      {
        _id: "sp-v142",
        title: "Fan dasturi (142-son buyruq)",
        status: "in_review",
        active: true,
        formVersion: "v142",
        approvalSteps: [
          { step: "teacher", status: "approved" },
          { step: "kafedra", status: "approved" },
          { step: "dean", status: "pending" },
        ],
        updatedAt: new Date(),
      },
    ]);

    const user = { _id: "u1", role: { title: ROLES.DEKAN } };
    const req = createReq({ entity: "scienceProgram" }, user);
    const res = createRes();
    await Controller.list(req, res, jest.fn());

    const items = res.json.mock.calls[0][0];
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      entity: "scienceProgram",
      id: "sp-v142",
      step: "dean",
    });
  });

  test("scienceProgram (v259) — dekan inbox'ida HECH NARSA ko'rmaydi (zanjirida bosqichi yo'q)", async () => {
    wireModel(ScienceProgramModel, [
      {
        _id: "sp-v259",
        title: "Fan dasturi (institut TZ)",
        status: "in_review",
        active: true,
        formVersion: "v259",
        approvalSteps: [
          { step: "teacher", status: "approved" },
          { step: "kafedra", status: "pending" },
          { step: "arm", status: "pending" },
          { step: "methodical", status: "pending" },
          { step: "prorektor", status: "pending" },
          { step: "rektor", status: "pending" },
        ],
        updatedAt: new Date(),
      },
    ]);

    const user = { _id: "u1", role: { title: ROLES.DEKAN } };
    const req = createReq({ entity: "scienceProgram" }, user);
    const res = createRes();
    await Controller.list(req, res, jest.fn());

    expect(res.json.mock.calls[0][0]).toEqual([]);
  });

  test("sillabus — submittedAt yuborish sanasini beradi, tahrir/tasdiq sanasini emas", async () => {
    wireModel(SyllabusModel, [
      {
        _id: "s1",
        title: "Sillabus 1",
        status: "in_review",
        active: true,
        submittedAt: new Date("2026-08-01"),
        approvalSteps: [
          { step: "kafedra", status: "approved", date: new Date("2026-08-05") },
          { step: "arm", status: "pending" },
          { step: "methodical", status: "pending" },
          { step: "prorektor", status: "pending" },
        ],
        updatedAt: new Date("2026-08-06"),
      },
    ]);

    const user = { _id: "u1", role: { title: ROLES.ARM } };
    const req = createReq({ entity: "syllabus" }, user);
    const res = createRes();
    await Controller.list(req, res, jest.fn());

    const items = res.json.mock.calls[0][0];
    expect(items).toHaveLength(1);
    expect(items[0].submittedAt).toEqual(new Date("2026-08-01"));
  });

  test("legacy sillabus (submittedAt yo'q) — eski fallback saqlanadi", async () => {
    wireModel(SyllabusModel, [
      {
        _id: "s2",
        title: "Legacy sillabus",
        status: "in_review",
        active: true,
        approvalSteps: [{ step: "kafedra", status: "pending" }],
        updatedAt: new Date("2026-08-06"),
      },
    ]);

    const user = { _id: "u1", role: { title: ROLES.KAFEDRA_MUDIRI } };
    const req = createReq({ entity: "syllabus" }, user);
    const res = createRes();
    await Controller.list(req, res, jest.fn());

    const items = res.json.mock.calls[0][0];
    expect(items).toHaveLength(1);
    expect(items[0].submittedAt).toEqual(new Date("2026-08-06"));
  });

  test("noma'lum entity= qiymati — 400 (next orqali)", async () => {
    const user = { _id: "u1", role: { title: ROLES.KAFEDRA_MUDIRI } };
    const req = createReq({ entity: "notARealEntity" }, user);
    const res = createRes();
    const next = jest.fn();
    await Controller.list(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400 }),
    );
    expect(res.json).not.toHaveBeenCalled();
  });

  test("REGRESSION-GUARD: scope filtri har entity so'roviga qo'shilgan (scope'siz so'rov yuborilmaydi)", async () => {
    wireModel(WorkloadDistributionModel, [
      {
        _id: "d1",
        title: "Taqsimot 1",
        status: "in_review",
        active: true,
        department: DEPT_ID,
        approvalSteps: [{ step: "dean", status: "pending" }],
        updatedAt: new Date(),
      },
    ]);

    const user = {
      _id: "u1",
      role: { title: ROLES.DEKAN },
      __scope: { department: { $in: [DEPT_ID] } },
    };
    const req = createReq({ entity: "distribution" }, user);
    const res = createRes();
    await Controller.list(req, res, jest.fn());

    expect(WorkloadDistributionModel.find).toHaveBeenCalledTimes(1);
    const calledFilter = WorkloadDistributionModel.find.mock.calls[0][0];
    expect(calledFilter).toHaveProperty("department");
    expect(calledFilter.department).toEqual({ $in: [DEPT_ID] });

    const items = res.json.mock.calls[0][0];
    expect(items).toHaveLength(1);
  });
  test("workloadSummary: reja-moliya o'z navbatidagi «Kafedralar hisobi»ni ko'radi", async () => {
    wireModel(WorkloadSummaryModel, [
      {
        _id: "s1",
        academicYearTitle: "2026/2027",
        academicYear: { _id: AY_ID, title: "2026/2027" },
        status: "in_review",
        active: true,
        snapshot: { totals: { total: 132 } },
        approvalSteps: [
          { step: "methodical", status: "approved", date: new Date("2026-09-21T06:00:00Z") },
          { step: "financial", status: "pending" },
          { step: "prorektor", status: "pending" },
          { step: "rektor", status: "pending" },
        ],
        updatedAt: new Date("2026-09-21T06:10:00Z"),
      },
    ]);

    const user = { _id: "u1", role: { title: ROLES.REJA_MOLIYA } };
    const req = createReq({ entity: "workloadSummary" }, user);
    const res = createRes();
    await Controller.list(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    const items = res.json.mock.calls[0][0];
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      entity: "workloadSummary",
      id: "s1",
      title: "2026/2027",
      step: "financial",
      department: null,
      academicYear: { _id: AY_ID, title: "2026/2027" },
      totalHour: 132,
    });
    const calledFilter = WorkloadSummaryModel.find.mock.calls[0][0];
    expect(calledFilter).not.toHaveProperty("department");
    expect(calledFilter.status).toBe("in_review");
  });

  test("workloadSummary: navbati kelmagan rektor hujjatni KO'RMAYDI", async () => {
    wireModel(WorkloadSummaryModel, [
      {
        _id: "s1",
        academicYearTitle: "2026/2027",
        status: "in_review",
        active: true,
        approvalSteps: [
          { step: "methodical", status: "approved" },
          { step: "financial", status: "pending" },
          { step: "prorektor", status: "pending" },
          { step: "rektor", status: "pending" },
        ],
        updatedAt: new Date(),
      },
    ]);

    const user = { _id: "u2", role: { title: ROLES.REKTOR } };
    const req = createReq({ entity: "workloadSummary" }, user);
    const res = createRes();
    await Controller.list(req, res, jest.fn());

    expect(res.json.mock.calls[0][0]).toEqual([]);
  });

  test("contingentReport: dekan o'z fakultetining yuborilgan hisobotini ko'radi (submittedAt ustuvor)", async () => {
    const FAC_ID = "ffffffffffffffffffffffff";
    wireModel(ContingentReportModel, [
      {
        _id: "c1",
        facultyTitle: "Davolash ishi fakulteti",
        faculty: FAC_ID,
        academicYear: { _id: AY_ID, title: "2026/2027" },
        status: "in_review",
        active: true,
        submittedAt: new Date("2026-09-22T05:00:00Z"),
        approvalSteps: [{ step: "dean", status: "pending" }],
        updatedAt: new Date("2026-09-22T06:00:00Z"),
      },
      {
        _id: "c2",
        facultyTitle: "Pediatriya fakulteti",
        faculty: "eeeeeeeeeeeeeeeeeeeeeeee",
        status: "in_review",
        active: true,
        approvalSteps: [{ step: "dean", status: "pending" }],
        updatedAt: new Date(),
      },
    ]);

    const user = { _id: "d1", role: { title: ROLES.DEKAN }, __scope: { faculty: FAC_ID } };
    const req = createReq({ entity: "contingentReport" }, user);
    const res = createRes();
    await Controller.list(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    const items = res.json.mock.calls[0][0];
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      entity: "contingentReport",
      id: "c1",
      title: "Davolash ishi fakulteti",
      step: "dean",
      department: null,
      academicYear: { _id: AY_ID, title: "2026/2027" },
      totalHour: null,
    });
    expect(new Date(items[0].submittedAt).toISOString()).toBe("2026-09-22T05:00:00.000Z");
    const calledFilter = ContingentReportModel.find.mock.calls[0][0];
    expect(calledFilter.faculty).toBe(FAC_ID);
    expect(calledFilter.status).toBe("in_review");
  });

  test("contingentReport: kotib (bosqichi yo'q) va O'UB inbox'da hech narsa ko'rmaydi", async () => {
    wireModel(ContingentReportModel, [
      {
        _id: "c1",
        facultyTitle: "Davolash ishi fakulteti",
        status: "in_review",
        active: true,
        approvalSteps: [{ step: "dean", status: "pending" }],
        updatedAt: new Date(),
      },
    ]);
    for (const title of [ROLES.FAKULTET_KENGASH_KOTIBI, ROLES.OQUV_USLUBIY_BOSHQARMA]) {
      const res = createRes();
      await Controller.list(
        createReq({ entity: "contingentReport" }, { _id: "x", role: { title } }),
        res,
        jest.fn(),
      );
      expect(res.json.mock.calls[0][0]).toEqual([]);
    }
  });
  test("workingSchedule: department = yo'nalish, totalHour = rejaning yillik umumiy soati (batch)", async () => {
    const DIR = { _id: "ffffffffffffffffffffffff", title: "Davolash ishi" };
    const ws = (id) => ({
      _id: id,
      title: `Ishchi reja ${id}`,
      direction: DIR,
      academicYear: { _id: AY_ID, title: "2026/2027" },
      status: "in_review",
      active: true,
      approvalHistory: [{ step: "methodical", status: "pending" }],
      updatedAt: new Date("2026-09-24T06:00:00Z"),
    });
    wireModel(WorkingScheduleModel, [ws("w1"), ws("w2")]);
    const sci = (hour) => ({
      code: "FA1", title: "Fan", totalCredit: 3,
      particle: [{ slug: "umumiy_yuklamaning_hajmi_soat", value: hour }],
    });
    const semesters = {
      1: { blocks: [{ blockCode: "MFI", title: "Majburiy fanlar", sciences: [sci(180)] }] },
      2: { blocks: [{ blockCode: "MFI", title: "Majburiy fanlar", sciences: [sci(120)] }] },
    };
    WorkingPlanModel.find = jest.fn(() => makeQuery([{ workingSchedule: "w1", semesters }]));

    const res = createRes();
    const user = { _id: "u1", role: { title: ROLES.SUPER_ADMIN } };
    await Controller.list(createReq({ entity: "workingSchedule" }, user), res, jest.fn());

    const items = res.json.mock.calls[0][0];
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    expect(byId.w1.department).toEqual({ _id: DIR._id, title: "Davolash ishi" });
    expect(byId.w1.totalHour).toBe(300);
    expect(byId.w1.totalHour).toBe(workingPlanYearTotals(semesters).umu);
    expect(byId.w2.totalHour).toBeNull();
    expect(WorkingPlanModel.find).toHaveBeenCalledTimes(1);
    expect(WorkingPlanModel.find.mock.calls[0][0]).toEqual({
      workingSchedule: { $in: ["w1", "w2"] },
    });
  });

  test("workingSchedule bo'lmagan entity — `department`/`totalHour` eskicha, workingPlan so'ralmaydi", async () => {
    wireModel(WorkloadSummaryModel, [
      {
        _id: "s1",
        academicYearTitle: "2026/2027",
        status: "in_review",
        active: true,
        snapshot: { totals: { total: 132 } },
        approvalSteps: [{ step: "financial", status: "pending" }],
        updatedAt: new Date(),
      },
    ]);
    WorkingPlanModel.find = jest.fn();
    const res = createRes();
    const user = { _id: "u1", role: { title: ROLES.REJA_MOLIYA } };
    await Controller.list(createReq({ entity: "workloadSummary" }, user), res, jest.fn());

    expect(res.json.mock.calls[0][0][0]).toMatchObject({ department: null, totalHour: 132 });
    expect(WorkingPlanModel.find).not.toHaveBeenCalled();
  });
});
