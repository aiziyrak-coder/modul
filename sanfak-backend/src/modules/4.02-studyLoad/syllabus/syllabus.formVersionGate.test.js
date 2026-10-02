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
const {
  createSyllabusSchema,
  updateSyllabusSchema,
} = require("./syllabus.validation");
const { ROLES } = require("#config/constants");

const TEACHER_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const FACULTY_ID = "ffffffffffffffffffffffff";
const SP_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const DOC_ID = "cccccccccccccccccccccccc";
const SCIENCE_ID = "5c1e0000000000000000ce01";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const approvedSp = (overrides = {}) => ({
  _id: SP_ID,
  science: SCIENCE_ID,
  directions: [],
  status: "approved",
  ...overrides,
});

const createReq = (body) => ({
  body,
  user: {
    _id: TEACHER_ID,
    role: { title: ROLES.OQITUVCHI },
    department: { faculty: FACULTY_ID },
  },
});

const validBody = (overrides = {}) => ({
  science: SCIENCE_ID,
  scienceProgram: SP_ID,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ADR-011 — v142 fan dasturidan sillabus yaratilmaydi (addSyllabus)", () => {
  test("(1) formVersion 'v142' → 400, xabarda '142-son'", async () => {
    ScienceProgram.findById.mockResolvedValue(
      approvedSp({ formVersion: "v142" }),
    );
    const res = createRes();
    const next = jest.fn();

    await Controller.addSyllabus(createReq(validBody()), res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(Syllabus).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(400);
    expect(err.message).toContain("142-son");
  });

  test("(2) formVersion 'v259' → 201 (yaratiladi)", async () => {
    ScienceProgram.findById.mockResolvedValue(
      approvedSp({ formVersion: "v259" }),
    );
    const res = createRes();
    const next = jest.fn();

    await Controller.addSyllabus(createReq(validBody()), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(Syllabus).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("(3) formVersion maydoni UMUMAN yo'q (legacy) → 201, bloklanmaydi", async () => {
    const sp = approvedSp();
    expect("formVersion" in sp).toBe(false);
    ScienceProgram.findById.mockResolvedValue(sp);
    const res = createRes();
    const next = jest.fn();

    await Controller.addSyllabus(createReq(validBody()), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("(5) ScienceProgram.findById proyeksiyasida `formVersion: 1` bor", async () => {
    ScienceProgram.findById.mockResolvedValue(
      approvedSp({ formVersion: "v259" }),
    );

    await Controller.addSyllabus(createReq(validBody()), createRes(), jest.fn());

    expect(ScienceProgram.findById).toHaveBeenCalledTimes(1);
    const [, projection] = ScienceProgram.findById.mock.calls[0];
    expect(projection).toEqual(expect.objectContaining({ formVersion: 1 }));
  });
});

describe("ADR-011 — `scienceProgram` CREATE'da majburiy (Joi)", () => {
  test("(4) scienceProgram berilmagan → validatsiya xatosi (400)", () => {
    const { error } = createSyllabusSchema.validate(
      { science: SCIENCE_ID },
      { abortEarly: false },
    );

    expect(error).toBeDefined();
    const keys = error.details.map((d) => d.path.join("."));
    expect(keys).toContain("scienceProgram");
  });

  test("(4b) scienceProgram bo'sh string → validatsiya xatosi", () => {
    const { error } = createSyllabusSchema.validate({
      science: SCIENCE_ID,
      scienceProgram: "",
    });
    expect(error).toBeDefined();
  });

  test("(4c) scienceProgram berilgan → validatsiya o'tadi", () => {
    const { error } = createSyllabusSchema.validate(validBody());
    expect(error).toBeUndefined();
  });

  test("(4d) updateSyllabusSchema — scienceProgram'siz PUT hamon o'tadi", () => {
    const { error } = updateSyllabusSchema.validate({ scienceTitle: "yangi" });
    expect(error).toBeUndefined();
  });
});

describe("ADR-011 — updateSyllabus ham bloklaydi (PUT bilan almashtirish)", () => {
  const updateReq = (body) => ({
    params: { id: DOC_ID },
    body,
    scope: {},
    user: { _id: TEACHER_ID, role: { title: ROLES.OQITUVCHI } },
  });

  beforeEach(() => {
    Syllabus.findOne.mockResolvedValue({
      _id: DOC_ID,
      status: "draft",
      author: { teacher: TEACHER_ID },
    });
    Syllabus.findByIdAndUpdate.mockResolvedValue({});
  });

  test("PUT { scienceProgram: <v142> } → 400, yozuv qilinmaydi", async () => {
    ScienceProgram.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ formVersion: "v142" }),
    });
    const res = createRes();
    const next = jest.fn();

    await Controller.updateSyllabus(
      updateReq({ scienceProgram: SP_ID }),
      res,
      next,
    );

    expect(Syllabus.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].statusCode).toBe(400);
    expect(next.mock.calls[0][0].message).toContain("142-son");
  });

  test("PUT { scienceProgram: <v259> } → 200 (yangilanadi)", async () => {
    ScienceProgram.findById.mockReturnValue({
      lean: jest
        .fn()
        .mockResolvedValue({ formVersion: "v259", status: "approved" }),
    });
    const res = createRes();
    const next = jest.fn();

    await Controller.updateSyllabus(
      updateReq({ scienceProgram: SP_ID }),
      res,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(Syllabus.findByIdAndUpdate).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
