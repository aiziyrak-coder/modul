"use strict";

jest.mock("#modules/4.02-studyLoad/workload/workload.model");
jest.mock("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
jest.mock("#modules/4.03-teacher/teacher/teacher.model");
jest.mock("#modules/4.03-teacher/personalWorkPlan/personalWorkPlan.model");
jest.mock("./report.model");

const WorkloadModel = require("#modules/4.02-studyLoad/workload/workload.model");
const Controller = require("./report.controller");

const wireWorkloads = (docs) => {
  const chain = { populate: jest.fn(() => chain), then: undefined };
  chain.populate = jest.fn(() => chain);
  chain.then = (resolve) => resolve(docs);
  WorkloadModel.find = jest.fn(() => chain);
};

const makeRes = () => {
  const res = {};
  res.setHeader = jest.fn();
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.end = jest.fn();
  return res;
};

beforeEach(() => jest.clearAllMocks());

describe("workloadReport — format=excel", () => {
  test("Excel yozuvi xato bersa — next(err) chaqiriladi (javobsiz osilib qolmaydi)", async () => {
    wireWorkloads([]);
    const res = makeRes();
    const next = jest.fn();
    const boom = new Error("yozuv oqimi uzildi");

    const ExcelJS = require("exceljs");
    const writeSpy = jest
      .spyOn(ExcelJS.Workbook.prototype.xlsx.constructor.prototype, "write")
      .mockRejectedValue(boom);

    try {
      await Controller.workloadReport({ query: { format: "excel" } }, res, next);
    } finally {
      writeSpy.mockRestore();
    }

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 400 });
    expect(res.end).not.toHaveBeenCalled();
  });

  test("muvaffaqiyat: sarlavhalar o'rnatiladi va javob yopiladi (xulq o'zgarmagan)", async () => {
    wireWorkloads([]);
    const res = makeRes();
    const next = jest.fn();

    const ExcelJS = require("exceljs");
    const writeSpy = jest
      .spyOn(ExcelJS.Workbook.prototype.xlsx.constructor.prototype, "write")
      .mockResolvedValue(undefined);

    try {
      await Controller.workloadReport({ query: { format: "excel" } }, res, next);
    } finally {
      writeSpy.mockRestore();
    }

    expect(next).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      'attachment; filename="workloads-report.xlsx"',
    );
    expect(res.end).toHaveBeenCalled();
  });

});

describe("workloadReport — boshqa yo'llar (xulq o'zgarmagan)", () => {
  test("format=json — Excel yo'liga umuman kirmaydi", async () => {
    wireWorkloads([]);
    const res = makeRes();
    const next = jest.fn();
    await Controller.workloadReport({ query: {} }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0]).toMatchObject({ total: 0 });
  });

  test("ma'lumot olishda xato — avvalgidek next(err)", async () => {
    WorkloadModel.find = jest.fn(() => {
      throw new Error("DB tushdi");
    });
    const res = makeRes();
    const next = jest.fn();
    await Controller.workloadReport({ query: { format: "excel" } }, res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 400 });
  });
});
