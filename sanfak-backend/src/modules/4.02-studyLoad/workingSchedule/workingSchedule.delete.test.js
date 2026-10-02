jest.mock("#modules/4.02-studyLoad/workingPlan/workingPlan.model");

const WorkingScheduleModel = require("./workingSchedule.model");
const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const Controller = require("./workingSchedule.controller");
const { ROLES } = require("#config/constants");

const USLUBI_USER = { role: { title: ROLES.OQUV_USLUBIY_BOSHQARMA } };

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makeDoc = (status, extra = {}) => ({
  _id: "ws1",
  status,
  deleteOne: jest.fn().mockResolvedValue(undefined),
  ...extra,
});

const LearningProcess = require("#modules/4.02-studyLoad/learningProcess/learningProcess.model");
const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
const stubStatusReset = (remaining) => {
  jest.spyOn(WorkingScheduleModel, "countDocuments").mockResolvedValue(remaining);
  const lpUpdate = jest.spyOn(LearningProcess, "updateOne").mockResolvedValue({ modifiedCount: 1 });
  const spUpdate = jest.spyOn(StudyPlanModel, "updateMany").mockResolvedValue({ modifiedCount: 1 });
  return { lpUpdate, spUpdate };
};

describe("workingSchedule.controller — delete (status darvozasi)", () => {
  beforeEach(() => {
    WorkingPlanModel.findOneAndDelete = jest.fn().mockResolvedValue(null);
    stubStatusReset(1);
  });
  afterEach(() => jest.restoreAllMocks());

  test.each(["in_review", "approved"])(
    "status='%s' — o'chirish TAQIQLANADI (400) va hujjat saqlanadi",
    async (status) => {
      const doc = makeDoc(status);
      jest.spyOn(WorkingScheduleModel, "findOne").mockResolvedValue(doc);
      const del = jest
        .spyOn(WorkingScheduleModel, "findOneAndDelete")
        .mockResolvedValue(doc);
      const res = createRes();
      const next = jest.fn();

      await Controller.delete(
        { params: { id: "ws1" }, scope: {}, user: USLUBI_USER },
        res,
        next,
      );

      expect(del).not.toHaveBeenCalled();
      expect(doc.deleteOne).not.toHaveBeenCalled();
      expect(WorkingPlanModel.findOneAndDelete).not.toHaveBeenCalled();

      const via400 = res.status.mock.calls.some((c) => c[0] === 400);
      const viaNext = next.mock.calls.some((c) => c[0]?.statusCode === 400);
      expect(via400 || viaNext).toBe(true);
    },
  );

  test.each(["draft", "rejected"])(
    "status='%s' — o'chirish RUXSAT ETILADI (200)",
    async (status) => {
      const doc = makeDoc(status);
      jest.spyOn(WorkingScheduleModel, "findOne").mockResolvedValue(doc);
      jest
        .spyOn(WorkingScheduleModel, "findOneAndDelete")
        .mockResolvedValue(doc);
      const res = createRes();

      await Controller.delete(
        { params: { id: "ws1" }, scope: {}, user: USLUBI_USER },
        res,
        jest.fn(),
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(WorkingPlanModel.findOneAndDelete).toHaveBeenCalledWith({
        workingSchedule: "ws1",
      });
    },
  );

  test("hujjat topilmasa — 404", async () => {
    jest.spyOn(WorkingScheduleModel, "findOne").mockResolvedValue(null);
    jest.spyOn(WorkingScheduleModel, "findOneAndDelete").mockResolvedValue(null);
    const res = createRes();

    await Controller.delete(
      { params: { id: "missing" }, scope: {} },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("scope tashqarisidagi hujjat — qidiruv req.scope bilan chaqiriladi", async () => {
    const findOne = jest
      .spyOn(WorkingScheduleModel, "findOne")
      .mockResolvedValue(null);
    jest.spyOn(WorkingScheduleModel, "findOneAndDelete").mockResolvedValue(null);
    const res = createRes();
    const foreignScope = { direction: { $in: ["own-dir"] } };

    await Controller.delete(
      { params: { id: "foreign-ws" }, scope: foreignScope, user: USLUBI_USER },
      res,
      jest.fn(),
    );

    expect(findOne).toHaveBeenCalledWith({
      _id: "foreign-ws",
      ...foreignScope,
    });
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("workingSchedule.controller — delete (P-06: LP status qaytarish)", () => {
  beforeEach(() => {
    WorkingPlanModel.findOneAndDelete = jest.fn().mockResolvedValue(null);
  });
  afterEach(() => jest.restoreAllMocks());

  const LP = "6a9a93839b17830309b6d12d";

  test("LP'da WS qolmadi (0) → LP va StudyPlan `created`→`new`, javobda learningProcessReset:true", async () => {
    const doc = makeDoc("draft", { learningProcess: LP });
    jest.spyOn(WorkingScheduleModel, "findOne").mockResolvedValue(doc);
    const { lpUpdate, spUpdate } = stubStatusReset(0);
    const res = createRes();

    await Controller.delete({ params: { id: "ws1" }, scope: {}, user: USLUBI_USER }, res, jest.fn());

    expect(WorkingScheduleModel.countDocuments).toHaveBeenCalledWith({ learningProcess: LP });
    expect(lpUpdate).toHaveBeenCalledWith({ _id: LP, status: "created" }, { $set: { status: "new" } });
    expect(spUpdate).toHaveBeenCalledWith({ learningProcess: LP, status: "created" }, { $set: { status: "new" } });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ learningProcessReset: true }));
  });

  test("LP'da boshqa WS qoldi (5) → status TEGILMAYDI, learningProcessReset:false", async () => {
    const doc = makeDoc("draft", { learningProcess: LP });
    jest.spyOn(WorkingScheduleModel, "findOne").mockResolvedValue(doc);
    const { lpUpdate, spUpdate } = stubStatusReset(5);
    const res = createRes();

    await Controller.delete({ params: { id: "ws1" }, scope: {}, user: USLUBI_USER }, res, jest.fn());

    expect(lpUpdate).not.toHaveBeenCalled();
    expect(spUpdate).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ learningProcessReset: false }));
  });

  test("status qaytarish xato bersa — o'chirish baribir 200 (faqat log)", async () => {
    const doc = makeDoc("draft", { learningProcess: LP });
    jest.spyOn(WorkingScheduleModel, "findOne").mockResolvedValue(doc);
    jest.spyOn(WorkingScheduleModel, "countDocuments").mockRejectedValue(new Error("db down"));
    const res = createRes();
    const next = jest.fn();

    await Controller.delete({ params: { id: "ws1" }, scope: {}, user: USLUBI_USER }, res, next);

    expect(doc.deleteOne).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  test("learningProcess'siz (yetim) WS → hisoblanmaydi, 200", async () => {
    const doc = makeDoc("draft");
    jest.spyOn(WorkingScheduleModel, "findOne").mockResolvedValue(doc);
    const cnt = jest.spyOn(WorkingScheduleModel, "countDocuments").mockResolvedValue(0);
    const res = createRes();

    await Controller.delete({ params: { id: "ws1" }, scope: {}, user: USLUBI_USER }, res, jest.fn());

    expect(cnt).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
