"use strict";

jest.mock("#modules/4.02-studyLoad/departmentContingent/departmentContingent.model", () => ({
  findOne: jest.fn(() => ({ select: () => ({ lean: () => Promise.resolve(null) }) })),
}));
jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
jest.mock("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
jest.mock("#references/direction/direction.model");
jest.mock("#references/department/department.model");
jest.mock("#references/academicYear/academicYear.model");
jest.mock("#modules/4.02-studyLoad/_services/groupStatsResolver");
jest.mock("#modules/4.02-studyLoad/_services/staffPositionsCalculator", () => ({
  buildStaffPositions: jest.fn().mockResolvedValue({}),
}));
jest.mock("#modules/4.02-studyLoad/_verify/documentVerify.service");
jest.mock("#modules/4.02-studyLoad/_shared/chainNotify", () => ({
  safeDispatchMany: jest.fn().mockResolvedValue(undefined),
  getDepartmentHeadUserIds: jest.fn().mockResolvedValue([]),
}));
jest.mock("#shared/pdfGenerators/pdfHelpers", () => ({
  ...jest.requireActual("#shared/pdfGenerators/pdfHelpers"),
  saveAndUpdatePdf: jest.fn().mockResolvedValue(null),
}));
jest.mock("./workload.model", () => {
  const actual = jest.requireActual("./workload.model");
  const Ctor = jest.fn(function WorkloadDoc(data) {
    Object.assign(this, data, { _id: "new-wl" });
    this.save = jest.fn().mockResolvedValue(this);
  });
  for (const k of ["calculateBlockTotal", "CLINICAL_PRACTICE_SHARE", "AUTO_CALCULATED_ITEM_SLUGS", "calcPerGroup"]) {
    Ctor[k] = actual[k];
  }
  Ctor.findById = jest.fn(() => ({ lean: () => Promise.resolve(null) }));
  return Ctor;
});

const WorkloadModel = require("./workload.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const DirectionModel = require("#references/direction/direction.model");
const DepartmentModel = require("#references/department/department.model");
const AcademicYearModel = require("#references/academicYear/academicYear.model");
const { getGroupStats } = require("#modules/4.02-studyLoad/_services/groupStatsResolver");
const Controller = require("./workload.controller");
const { ROLES } = require("#config/constants");

const AY = "aaaaaaaaaaaaaaaaaaaaaaaa";
const DEPT = "bbbbbbbbbbbbbbbbbbbbbbbb";

const chain = (value) => ({
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(value),
  then: (ok, bad) => Promise.resolve(value).then(ok, bad),
});

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

function mockPipeline(existingWorkloads) {
  WorkingScheduleModel.find = jest.fn().mockResolvedValue([
    { _id: "ws1", direction: "dir1", year: "2026", academicYear: AY, groups: ["g1"], currentCourse: 1, courseRef: "c1", status: "approved" },
  ]);
  WorkingPlanModel.findOne = jest.fn().mockResolvedValue({
    _id: "wp1",
    studyPlan: null,
    semesters: { 1: { blocks: [{ title: "I. Fanlar", sciences: [{ code: "F1", title: "Anatomiya", science: "sci1", department: DEPT, particle: [] }] }] } },
  });
  DirectionModel.findById = jest.fn(() => chain({}));
  DepartmentModel.findById = jest.fn(() => chain({ title: "Anatomiya kafedrasi" }));
  AcademicYearModel.find = jest.fn(() => chain([]));
  AcademicYearModel.findById = jest.fn(() => chain({ title: "2026/2027" }));
  getGroupStats.mockResolvedValue({ groupCount: 1, studentCount: 10, streamCount: 1 });
  WorkloadModel.find = jest.fn().mockResolvedValue(existingWorkloads);
}

async function runAdd(existing) {
  mockPipeline(existing);
  const res = createRes();
  const next = jest.fn();
  await Controller.addWorkload({ body: { department: DEPT, academicYear: AY } }, res, next);
  return { res, next };
}

beforeEach(() => jest.clearAllMocks());

describe("addWorkload — ADR-043 ochiq versiya darvozasi", () => {
  test("ochiq (in_review) versiya bor → 409, yangi hujjat YARATILMAYDI", async () => {
    const { next, res } = await runAdd([{ _id: "open1", status: "in_review", version: 2 }]);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(409);
    expect(err.meta).toMatchObject({ reason: "open_version_exists", openWorkloadId: "open1" });
    expect(WorkloadModel).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test("approved v1 bor → 201, version 2 + previousVersion v1", async () => {
    const { next, res } = await runAdd([{ _id: "v1", status: "approved", version: 1 }]);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(WorkloadModel.mock.calls[0][0]).toMatchObject({ version: 2, previousVersion: "v1", department: DEPT });
    expect(res.json.mock.calls[0][0]).toMatchObject({ version: 2 });
  });

  test("hech narsa yo'q → 1-versiya", async () => {
    const { res } = await runAdd([]);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(WorkloadModel.mock.calls[0][0]).toMatchObject({ version: 1, previousVersion: null });
  });

  test("save E11000 (version indeksi) → 409 open_version_exists, 400 EMAS", async () => {
    const dup = Object.assign(new Error("E11000 duplicate key"), {
      code: 11000,
      keyPattern: { department: 1, academicYear: 1, version: 1 },
    });
    WorkloadModel.mockImplementationOnce(function WorkloadDoc(data) {
      Object.assign(this, data);
      this.save = jest.fn().mockRejectedValue(dup);
    });
    const { next, res } = await runAdd([{ _id: "v1", status: "approved", version: 1 }]);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(409);
    expect(err.meta).toEqual({ reason: "open_version_exists" });
    expect(res.status).not.toHaveBeenCalled();
  });

  test("boshqa xato (E11000 emas) — avvalgidek 400", async () => {
    WorkloadModel.mockImplementationOnce(function WorkloadDoc(data) {
      Object.assign(this, data);
      this.save = jest.fn().mockRejectedValue(new Error("boom"));
    });
    const { next } = await runAdd([]);
    expect(next.mock.calls[0][0].statusCode).toBe(400);
  });
});

describe("addWorkload — D-11 Jadval 2 ko'chirish", () => {
  test("v2 — oldingi versiyaning Jadval 2 qatorlari `_id`siz ko'chadi", async () => {
    WorkloadModel.findById = jest.fn(() => ({
      lean: () =>
        Promise.resolve({
          staffPositions: { items: [{ _id: "i1", slug: "assistant", title: "Assistent", positions: 3 }] },
        }),
    }));
    const { res } = await runAdd([{ _id: "v1", status: "approved", version: 1 }]);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(WorkloadModel.findById).toHaveBeenCalledWith("v1", { "staffPositions.items": 1 });
    expect(WorkloadModel.mock.calls[0][0].staffPositions.items).toEqual([
      { slug: "assistant", title: "Assistent", positions: 3 },
    ]);
  });
});

const steps = (lastStatus) =>
  ["methodical", "kafedra", "financial", "prorektor", "rektor"].map((step, i) => ({
    step,
    status: i === 4 ? lastStatus : "approved",
  }));

async function runApprove(doc, role = ROLES.REKTOR) {
  WorkloadModel.findOne = jest.fn().mockResolvedValue(doc);
  const res = createRes();
  const next = jest.fn();
  await Controller.approve(
    { params: { id: doc._id }, body: {}, query: {}, scope: {}, user: { _id: "u1", role: { title: role } } },
    res,
    next,
  );
  return { res, next };
}

const approveDoc = (over = {}) => ({
  _id: "v1",
  department: DEPT,
  academicYear: AY,
  version: 1,
  status: "in_review",
  approvalSteps: steps("pending"),
  save: jest.fn().mockResolvedValue(undefined),
  ...over,
});

describe("approve — ADR-043 kattaroq versiya himoyasi", () => {
  test("kattaroq versiyali approved bor (qaytarilgan eski versiya qayta tasdiqlanmoqda) → 409, saqlanmaydi, supersede YO'Q", async () => {
    WorkloadModel.exists = jest.fn().mockResolvedValue({ _id: "v2" });
    WorkloadModel.updateMany = jest.fn();
    const doc = approveDoc();
    const { next } = await runApprove(doc);
    expect(next.mock.calls[0][0].statusCode).toBe(409);
    expect(next.mock.calls[0][0].meta).toEqual({ reason: "newer_version_approved" });
    expect(doc.save).not.toHaveBeenCalled();
    expect(doc.status).toBe("in_review");
    expect(WorkloadModel.updateMany).not.toHaveBeenCalled();
  });

  test("yakuniy tasdiq → approved + eski approvedlar superseded (javobda soni)", async () => {
    WorkloadModel.exists = jest.fn().mockResolvedValue(null);
    WorkloadModel.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 1 });
    const doc = approveDoc({ _id: "v2", version: 2 });
    const { res } = await runApprove(doc);
    expect(doc.status).toBe("approved");
    expect(WorkloadModel.updateMany.mock.calls[0][0]).toMatchObject({ _id: { $ne: "v2" }, department: DEPT, academicYear: AY, status: "approved" });
    expect(res.json.mock.calls[0][0]).toMatchObject({ status: "approved", superseded: 1 });
  });

  test("oraliq bosqich → supersede ham, versiya tekshiruvi ham YO'Q", async () => {
    WorkloadModel.exists = jest.fn();
    WorkloadModel.updateMany = jest.fn();
    const doc = approveDoc({ approvalSteps: [...steps("pending").slice(0, 3), { step: "prorektor", status: "pending" }, { step: "rektor", status: "pending" }] });
    await runApprove(doc, ROLES.PROREKTOR);
    expect(doc.status).toBe("in_review");
    expect(WorkloadModel.exists).not.toHaveBeenCalled();
    expect(WorkloadModel.updateMany).not.toHaveBeenCalled();
  });
});

describe("approve (yuborish) — D-11 Jadval 2 darvozasi", () => {
  const draft = (staffPositions) =>
    approveDoc({ status: "draft", approvalSteps: steps("pending").map((s) => ({ ...s, status: "pending" })), staffPositions });

  test("ish o'rni kutiladi, lavozimlar bo'sh — 400, holat draft qoladi", async () => {
    const doc = draft({ totalPositions: 2, items: [] });
    const { next } = await runApprove(doc, ROLES.OQUV_USLUBIY_BOSHQARMA);
    expect(next.mock.calls[0][0].statusCode).toBe(400);
    expect(doc.status).toBe("draft");
    expect(doc.save).not.toHaveBeenCalled();
  });

  test("lavozimlar to'ldirilgan — yuboriladi", async () => {
    const doc = draft({ totalPositions: 2, items: [{ slug: "assistant", positions: 2 }] });
    await runApprove(doc, ROLES.OQUV_USLUBIY_BOSHQARMA);
    expect(doc.status).toBe("in_review");
  });
});
