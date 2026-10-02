jest.mock("./syllabus.model", () => {
  const SyllabusMock = jest.fn(function (payload = {}) {
    Object.assign(this, payload);
    this._id = "5111111111111111111111111";
    this.status = payload.status || "draft";
    this.set = jest.fn();
    this.save = jest.fn().mockResolvedValue(undefined);
  });
  SyllabusMock.findOne = jest.fn();
  SyllabusMock.findByIdAndUpdate = jest.fn().mockResolvedValue({});
  return SyllabusMock;
});

jest.mock(
  "#modules/4.02-studyLoad/scienceProgram/scienceProgram.model",
  () => ({ findById: jest.fn() }),
);

jest.mock("#shared/pdfGenerators/pdfHelpers", () => ({
  ...jest.requireActual("#shared/pdfGenerators/pdfHelpers"),
  shouldRegeneratePdf: jest.fn(() => false),
  saveAndUpdatePdf: jest.fn(),
}));

const Syllabus = require("./syllabus.model");
const ScienceProgram = require("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");
const Controller = require("./syllabus.controller");
const { ROLES } = require("#config/constants");

const TEACHER_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const FACULTY_ID = "ffffffffffffffffffffffff";
const SP_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const SCIENCE_ID = "5c1e0000000000000000ce01";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createReq = (body) => ({
  body,
  user: {
    _id: TEACHER_ID,
    role: { title: ROLES.OQITUVCHI },
    department: { faculty: FACULTY_ID },
  },
});

const approvedSp = () => ({
  _id: SP_ID,
  science: SCIENCE_ID,
  status: "approved",
  formVersion: "v259",
  semester: 3,
  credits: 4,
  totalHours: 120,
  learningOutcome: { desc: "SP maqsadi" },
  theoretical: {
    topics: [{ title: "Mavzu A" }, { title: "Mavzu B" }],
  },
});

const lastCreate = () => {
  const ctorArg = Syllabus.mock.calls[0][0];
  const inst = Syllabus.mock.instances[0];
  const setArg = inst.set.mock.calls.length ? inst.set.mock.calls[0][0] : {};
  return { ctorArg, setArg };
};

beforeEach(() => {
  jest.clearAllMocks();
  ScienceProgram.findById.mockResolvedValue(approvedSp());
});

describe("F-16 — manual `scienceContent.topics` SP auto-fill ustidan yozilmaydi (addSyllabus)", () => {
  test("(1) o'qituvchi soatlari bilan yuborsa — konstruktorda o'sha soatlar, `set`da `scienceContent.topics` YO'Q", async () => {
    const res = createRes();
    const next = jest.fn();
    const manualTopics = [
      { topic: "Mavzu A", hour: 2 },
      { topic: "Mavzu B", hour: 4 },
    ];

    await Controller.addSyllabus(
      createReq({
        science: SCIENCE_ID,
        scienceProgram: SP_ID,
        scienceContent: { topics: manualTopics },
      }),
      res,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    const { ctorArg, setArg } = lastCreate();
    expect(ctorArg.scienceContent).toEqual({ topics: manualTopics });
    expect(setArg).not.toHaveProperty("scienceContent.topics");
  });

  test("(2) manual `scienceContent` yo'q → SP mavzulari (hour 0) `set` orqali to'ldiriladi (eski xulq saqlanadi)", async () => {
    const res = createRes();
    const next = jest.fn();

    await Controller.addSyllabus(
      createReq({ science: SCIENCE_ID, scienceProgram: SP_ID }),
      res,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    const { setArg } = lastCreate();
    expect(setArg["scienceContent.topics"]).toEqual([
      { topic: "Mavzu A", hour: 0 },
      { topic: "Mavzu B", hour: 0 },
    ]);
  });

  test("(3) manual `scienceContent.topics: []` (bo'sh) → SP'dan to'ldiriladi", async () => {
    const res = createRes();
    const next = jest.fn();

    await Controller.addSyllabus(
      createReq({
        science: SCIENCE_ID,
        scienceProgram: SP_ID,
        scienceContent: { topics: [] },
      }),
      res,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    const { setArg } = lastCreate();
    expect(setArg["scienceContent.topics"]).toHaveLength(2);
  });

  test("(4) `sciencePurpose.desc` manual berilmagan → SP'dan keladi (boshqa auto-maydonlar o'zgarmaydi)", async () => {
    const res = createRes();
    const next = jest.fn();

    await Controller.addSyllabus(
      createReq({
        science: SCIENCE_ID,
        scienceProgram: SP_ID,
        scienceContent: { topics: [{ topic: "Mavzu A", hour: 2 }] },
      }),
      res,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    const { setArg } = lastCreate();
    expect(setArg["sciencePurpose.desc"]).toBe("SP maqsadi");
    expect(setArg).not.toHaveProperty("scienceContent.topics");
  });
});
