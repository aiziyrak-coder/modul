"use strict";

jest.mock("#modules/4.02-studyLoad/workload/workload.model");
jest.mock("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
jest.mock("#modules/4.03-teacher/teacher/teacher.model");
jest.mock("#modules/4.03-teacher/personalWorkPlan/personalWorkPlan.model");
jest.mock("./report.model");

const WorkloadModel = require("#modules/4.02-studyLoad/workload/workload.model");
const WorkloadDistModel = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const TeacherProfile = require("#modules/4.03-teacher/teacher/teacher.model");
const PersonalWorkPlan = require("#modules/4.03-teacher/personalWorkPlan/personalWorkPlan.model");
const Controller = require("./report.controller");

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => jest.clearAllMocks());

describe("summaryReport — superseded jamiga kirmaydi", () => {
  test("yuklama/taqsimot total so'rovida status ≠ superseded", async () => {
    for (const M of [WorkloadModel, WorkloadDistModel, TeacherProfile, PersonalWorkPlan]) {
      M.countDocuments = jest.fn().mockResolvedValue(0);
    }
    await Controller.summaryReport({ query: { academicYear: "ay" } }, makeRes(), jest.fn());
    expect(WorkloadModel.countDocuments.mock.calls[0][0]).toEqual({ academicYear: "ay", status: { $ne: "superseded" } });
    expect(WorkloadModel.countDocuments.mock.calls[1][0]).toEqual({ academicYear: "ay", status: "approved" });
    expect(WorkloadDistModel.countDocuments.mock.calls[0][0]).toEqual({ academicYear: "ay", status: { $ne: "superseded" } });
  });
});

describe("distributionReport — superseded/nofaol qatorlarga kirmaydi (ADR-043 review)", () => {
  const mockFind = (docs) => {
    const chain = { populate: jest.fn(() => chain), then: (ok, bad) => Promise.resolve(docs).then(ok, bad) };
    WorkloadDistModel.find = jest.fn(() => chain);
  };

  test("filtr: active ≠ false va status ≠ superseded (so'rov filtri saqlanadi)", async () => {
    mockFind([]);
    await Controller.distributionReport({ query: { academicYear: "ay", department: "d1" } }, makeRes(), jest.fn());
    expect(WorkloadDistModel.find.mock.calls[0][0]).toEqual({
      academicYear: "ay",
      department: "d1",
      active: { $ne: false },
      $and: [{ status: { $ne: "superseded" } }],
    });
  });

  test("?status=superseded ham tarixiy qatorni qaytarmaydi ($and bilan kesishadi)", async () => {
    mockFind([]);
    await Controller.distributionReport({ query: { status: "superseded" } }, makeRes(), jest.fn());
    const filter = WorkloadDistModel.find.mock.calls[0][0];
    expect(filter.status).toBe("superseded");
    expect(filter.$and).toEqual([{ status: { $ne: "superseded" } }]);
  });

  test("qatorlar faqat DB qaytargan (faol) taqsimotdan quriladi", async () => {
    mockFind([{ department: { title: "K" }, academicYear: { title: "Y" }, teachers: [{ isVacant: true, totalHour: 10 }] }]);
    const res = makeRes();
    await Controller.distributionReport({ query: {} }, res, jest.fn());
    expect(res.json.mock.calls[0][0]).toMatchObject({ total: 1, data: [{ "Jami soat": 10, "O'qituvchi": "VAKANT" }] });
  });
});

describe("workloadReport — Holat yorlig'i", () => {
  test("superseded → «O'z kuchini yo'qotgan», qolganlari o'zgarmagan", async () => {
    const docs = [
      { _id: "a", status: "superseded", date: "01.09.2026" },
      { _id: "b", status: "approved", date: "20.09.2026" },
    ];
    const chain = { populate: jest.fn(() => chain), then: (ok) => ok(docs) };
    WorkloadModel.find = jest.fn(() => chain);
    const res = makeRes();
    await Controller.workloadReport({ query: {} }, res, jest.fn());
    const { data } = res.json.mock.calls[0][0];
    expect(data[0].Holat).toBe("O'z kuchini yo'qotgan (superseded)");
    expect(data[1].Holat).toBe("approved");
  });
});
