"use strict";

jest.mock("./workloadDistribution.model");
jest.mock("#modules/4.02-studyLoad/workload/workload.model");
jest.mock("#modules/4.01-auth/user/user.model");
jest.mock("#system/notification/notificationDispatcher", () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("#modules/4.02-studyLoad/_verify/documentVerify.service");
jest.mock("#shared/pdfGenerators/pdfHelpers", () => ({
  ...jest.requireActual("#shared/pdfGenerators/pdfHelpers"),
  saveAndUpdatePdf: jest.fn().mockResolvedValue(null),
}));

const Workload = require("#modules/4.02-studyLoad/workload/workload.model");
const WorkloadDistribution = require("./workloadDistribution.model");
const UserModel = require("#modules/4.01-auth/user/user.model");
const Controller = require("./workloadDistribution.controller");
const { supersedePreviousDistributions } = require("./workloadDistribution.supersede");
const { ROLES } = require("#config/constants");

const NEW_WL = { _id: "wl-v2", department: "dep-1", academicYear: "ay-1" };

beforeEach(() => {
  jest.clearAllMocks();
  UserModel.find = jest.fn().mockReturnValue({
    populate: () => ({ select: () => ({ lean: () => Promise.resolve([]) }) }),
  });
});

describe("supersedePreviousDistributions", () => {
  test("eski (superseded) yuklama taqsimotlari → superseded + active:false", async () => {
    Workload.findById = jest.fn().mockResolvedValue(NEW_WL);
    Workload.distinct = jest.fn().mockResolvedValue(["wl-v1"]);
    WorkloadDistribution.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 1 });

    const n = await supersedePreviousDistributions({ _id: "d-v2", workload: "wl-v2" });

    expect(n).toBe(1);
    expect(Workload.distinct).toHaveBeenCalledWith("_id", {
      _id: { $ne: "wl-v2" },
      department: "dep-1",
      academicYear: "ay-1",
      status: "superseded",
    });
    const [filter, update] = WorkloadDistribution.updateMany.mock.calls[0];
    expect(filter).toEqual({ _id: { $ne: "d-v2" }, workload: { $in: ["wl-v1"] }, status: { $ne: "superseded" } });
    expect(update.$set).toMatchObject({ status: "superseded", active: false, supersededBy: "d-v2" });
  });

  test("eski versiya yo'q → yozuv YO'Q", async () => {
    Workload.findById = jest.fn().mockResolvedValue(NEW_WL);
    Workload.distinct = jest.fn().mockResolvedValue([]);
    WorkloadDistribution.updateMany = jest.fn();
    expect(await supersedePreviousDistributions({ _id: "d-v2", workload: "wl-v2" })).toBe(0);
    expect(WorkloadDistribution.updateMany).not.toHaveBeenCalled();
  });
});

const makeDist = (lastStatus) => ({
  _id: "d-v2",
  workload: "wl-v2",
  department: "dep-1",
  status: "in_review",
  teachers: [],
  approvalSteps: ["kafedra", "methodical", "financial", "dean", "prorektor"].map((step, i) => ({
    step,
    status: i === 4 ? lastStatus : i < 3 ? "approved" : "pending",
  })),
  save: jest.fn().mockResolvedValue(undefined),
});

async function approve(doc, role) {
  WorkloadDistribution.findOne = jest.fn().mockResolvedValue(doc);
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  await Controller.approve(
    { params: { id: doc._id }, body: {}, query: {}, scope: {}, user: { _id: "u", role: { title: role } } },
    res,
    jest.fn(),
  );
  return res;
}

describe("approve — almashinuv faqat YANGI taqsimot approved bo'lganda", () => {
  test("oraliq bosqich (dean) → eski taqsimotga tegilmaydi", async () => {
    Workload.findById = jest.fn();
    WorkloadDistribution.updateMany = jest.fn();
    const doc = makeDist("pending");
    const res = await approve(doc, ROLES.DEKAN);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(doc.approvalSteps[3].status).toBe("approved");
    expect(doc.status).toBe("in_review");
    expect(Workload.findById).not.toHaveBeenCalled();
    expect(WorkloadDistribution.updateMany).not.toHaveBeenCalled();
  });

  test("yakuniy (prorektor) → approved + eski versiya taqsimoti superseded", async () => {
    Workload.findById = jest.fn().mockResolvedValue(NEW_WL);
    Workload.distinct = jest.fn().mockResolvedValue(["wl-v1"]);
    WorkloadDistribution.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 1 });
    const doc = makeDist("pending");
    doc.approvalSteps[3].status = "approved";
    const res = await approve(doc, ROLES.PROREKTOR);
    expect(doc.status).toBe("approved");
    expect(WorkloadDistribution.updateMany).toHaveBeenCalledTimes(1);
    expect(res.json.mock.calls[0][0]).toMatchObject({ status: "approved", superseded: 1 });
  });
});
