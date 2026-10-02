jest.mock("./scienceProgram.model");
jest.mock(
  "#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model",
);
jest.mock("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
jest.mock("#shared/pdfGenerators/pdfHelpers", () => ({
  ...jest.requireActual("#shared/pdfGenerators/pdfHelpers"),
  shouldRegeneratePdf: jest.fn(() => false),
  saveAndUpdatePdf: jest.fn(),
}));

const ScienceProgram = require("./scienceProgram.model");
const WorkloadDistModel = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const WorkingPlan = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const Controller = require("./scienceProgram.controller");
const { ROLES } = require("#config/constants");

const TEACHER_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER_TEACHER_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const SCIENCE_ID = "cccccccccccccccccccccccc";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makeDistQuery = (result) => {
  const q = {};
  q.select = jest.fn().mockReturnValue(q);
  q.lean = jest.fn().mockResolvedValue(result);
  return q;
};

const teacherReq = (userId, body = {}) => ({
  body: { science: SCIENCE_ID, ...body },
  user: { _id: userId, role: { title: ROLES.OQITUVCHI } },
});

describe("REGRESSION-GUARD — D-125: addScienceProgram faqat qabul qilingan yuklama", () => {
  let saveMock;

  beforeEach(() => {
    jest.clearAllMocks();

    saveMock = jest.fn().mockResolvedValue(undefined);
    ScienceProgram.mockImplementation(function ctor(doc) {
      this.doc = doc;
      this._id = "sp-1";
      this.status = "draft";
      this.save = saveMock;
      this.set = jest.fn();
    });

    WorkingPlan.findOne = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(null),
    });
    WorkingScheduleModel.find = jest.fn().mockReturnValue({
      distinct: jest.fn().mockResolvedValue([]),
    });
  });

  test("QABUL QILGAN: yuklama accepted bo'lsa — 201, save chaqiriladi", async () => {
    WorkloadDistModel.findOne = jest
      .fn()
      .mockReturnValue(makeDistQuery({ _id: "d1" }));
    const res = createRes();
    const next = jest.fn();

    await Controller.addScienceProgram(teacherReq(TEACHER_ID), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(saveMock).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("REGRESSION GUARD: faqat pending (accepted emas) — 400, save CHAQIRILMAYDI", async () => {
    WorkloadDistModel.findOne = jest.fn().mockReturnValue(makeDistQuery(null));
    const next = jest.fn();

    await Controller.addScienceProgram(
      teacherReq(OTHER_TEACHER_ID),
      createRes(),
      next,
    );

    expect(saveMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message:
          "Fan dasturi faqat siz QABUL QILGAN yuklamadagi fan uchun yaratiladi. Avval yuklama taqsimotini qabul qiling",
      }),
    );
  });

  test("FILTR ISBOTI: DB so'rovi req.user + accepted + blocks.science bo'yicha filtrlaydi", async () => {
    WorkloadDistModel.findOne = jest
      .fn()
      .mockReturnValue(makeDistQuery({ _id: "d1" }));
    const res = createRes();
    const next = jest.fn();

    await Controller.addScienceProgram(teacherReq(TEACHER_ID), res, next);

    expect(WorkloadDistModel.findOne).toHaveBeenCalledTimes(1);
    const filter = WorkloadDistModel.findOne.mock.calls[0][0];
    expect(filter.teachers.$elemMatch.teacher).toBe(TEACHER_ID);
    expect(filter.teachers.$elemMatch.acceptanceStatus).toBe("accepted");
    expect(filter.teachers.$elemMatch.blocks.$elemMatch.science).toBe(
      SCIENCE_ID,
    );
    expect(filter.teachers.$elemMatch.blocks.$elemMatch.type).toBe("lesson");

    expect(filter.$or).toBeUndefined();
  });

  test("SUPER_ADMIN bypass: guard umuman ishlamaydi, findOne chaqirilmaydi, 201", async () => {
    WorkloadDistModel.findOne = jest.fn().mockReturnValue(makeDistQuery(null));
    const res = createRes();
    const next = jest.fn();
    const req = {
      body: { science: SCIENCE_ID },
      user: { _id: OTHER_TEACHER_ID, role: { title: ROLES.SUPER_ADMIN } },
    };

    await Controller.addScienceProgram(req, res, next);

    expect(WorkloadDistModel.findOne).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(saveMock).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
