"use strict";

jest.mock("#modules/4.02-studyLoad/_shared/chainRegistry", () => ({
  CHAIN_REGISTRY: {
    workload: {
      stepsField: "approvalSteps",
      stepRoles: { methodical: "TEST_YANGI_ROL" },
    },
    workloadDistribution: { stepsField: "approvalSteps", stepRoles: {} },
    scienceProgram: { stepsField: "approvalSteps", stepRoles: {} },
    syllabus: { stepsField: "approvalSteps", stepRoles: {} },
    workingSchedule: { stepsField: "approvalHistory", stepRoles: {} },
    workloadSummary: { stepsField: "approvalSteps", stepRoles: {} },
    contingentReport: { stepsField: "approvalSteps", stepRoles: {} },
  },
}));

jest.mock("#modules/4.02-studyLoad/workload/workload.model");
jest.mock("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
jest.mock("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");
jest.mock("#modules/4.02-studyLoad/syllabus/syllabus.model");
jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
jest.mock("#modules/4.02-studyLoad/workloadSummary/workloadSummary.model");
jest.mock("#modules/4.02-studyLoad/contingentReport/contingentReport.model");
jest.mock("#modules/4.02-studyLoad/contingentReport/contingentReport.scope", () =>
  jest.fn(() => (req, res, next) => {
    req.scope = {};
    next();
  }),
);

jest.mock("#modules/4.02-studyLoad/workload/workload.scope", () =>
  jest.fn(() => (req, res, next) => {
    req.scope = {};
    next();
  }),
);
jest.mock(
  "#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.scope",
  () =>
    jest.fn(() => (req, res, next) => {
      req.scope = {};
      next();
    }),
);
jest.mock("#modules/4.02-studyLoad/scienceProgram/scienceProgram.scope", () =>
  jest.fn(() => (req, res, next) => {
    req.scope = {};
    next();
  }),
);
jest.mock("#modules/4.02-studyLoad/syllabus/syllabus.scope", () =>
  jest.fn(() => (req, res, next) => {
    req.scope = {};
    next();
  }),
);
jest.mock(
  "#modules/4.02-studyLoad/workingSchedule/workingSchedule.scope",
  () =>
    jest.fn(() => (req, res, next) => {
      req.scope = {};
      next();
    }),
);

const WorkloadModel = require("#modules/4.02-studyLoad/workload/workload.model");
const Controller = require("./approvalInbox.controller");

function makeQuery(docs) {
  const q = {};
  q.select = jest.fn().mockReturnValue(q);
  q.populate = jest.fn().mockReturnValue(q);
  q.lean = jest.fn().mockReturnValue(q);
  q.exec = jest.fn().mockResolvedValue(docs);
  return q;
}

const createReq = (query, user) => ({ query: query || {}, user });
const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

test("CHAIN_REGISTRY.workload.stepRoles o'zgarsa — inbox AVTOMATIK ergashadi (qo'lda nusxa yo'q)", async () => {
  WorkloadModel.find = jest.fn(() =>
    makeQuery([
      {
        _id: "1",
        title: "Yuklama",
        status: "in_review",
        active: true,
        approvalSteps: [{ step: "methodical", status: "pending" }],
        updatedAt: new Date(),
      },
    ]),
  );

  const user = { _id: "u1", role: { title: "TEST_YANGI_ROL" } };
  const req = createReq({ entity: "workload" }, user);
  const res = createRes();
  await Controller.list(req, res, jest.fn());

  const items = res.json.mock.calls[0][0];
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({
    entity: "workload",
    id: "1",
    step: "methodical",
  });
});
