jest.mock("./workloadDistribution.model");
jest.mock("#modules/4.02-studyLoad/workload/workload.model");
jest.mock("#shared/pdfGenerators/pdfHelpers", () => ({
  ...jest.requireActual("#shared/pdfGenerators/pdfHelpers"),
  shouldRegeneratePdf: jest.fn(() => false),
  saveAndUpdatePdf: jest.fn(),
}));
jest.mock("#modules/4.02-studyLoad/_services/workloadValidator", () => ({
  validateTeacherMinHours: jest.fn().mockResolvedValue([]),
  validateMaxOverload: jest.fn(),
}));

const WorkloadDistribution = require("./workloadDistribution.model");
const {
  validateTeacherMinHours,
  validateMaxOverload,
} = require("#modules/4.02-studyLoad/_services/workloadValidator");
const Controller = require("./workloadDistribution.controller");
const { ROLES } = require("#config/constants");

const DOC_ID = "cccccccccccccccccccccccc";
const DEPT_ID = "dddddddddddddddddddddddd";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createReq = () => ({
  params: { id: DOC_ID },
  body: {},
  scope: { department: DEPT_ID },
  user: { _id: "eeeeeeeeeeeeeeeeeeeeeeee", role: { title: ROLES.KAFEDRA_MUDIRI } },
});

const draftDoc = (teachers) => ({
  _id: DOC_ID,
  status: "draft",
  department: DEPT_ID,
  teachers,
  approvalSteps: [
    { step: "kafedra", status: "pending" },
    { step: "methodical", status: "pending" },
  ],
  save: jest.fn().mockResolvedValue(undefined),
});

beforeEach(() => {
  jest.clearAllMocks();
  validateTeacherMinHours.mockResolvedValue([]);
});

describe("TZ 4.2.4 — ortiqcha yuklama ogohlantirishi (bloklovchi EMAS)", () => {
  test("ortiqcha yuklama bo'lsa — submit O'TADI va warnings qaytadi", async () => {
    const warning = {
      teacherEntryId: "666666666666666666666666",
      totalHour: 900,
      maxHour: 600,
      excess: 300,
      message: "Ortiqcha yuklama: 900 > 600 (1.5× normadan oshib ketdi)",
      severity: "warning",
    };
    validateMaxOverload.mockResolvedValue(warning);
    WorkloadDistribution.findOne = jest
      .fn()
      .mockResolvedValue(draftDoc([{ _id: "666666666666666666666666" }]));

    const res = createRes();
    await Controller.approve(createReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.action).toBe("submitted");
    expect(payload.status).toBe("in_review");
    expect(payload.warnings).toEqual([warning]);
  });

  test("ortiqcha yuklama YO'Q bo'lsa — warnings bo'sh massiv", async () => {
    validateMaxOverload.mockResolvedValue(null);
    WorkloadDistribution.findOne = jest
      .fn()
      .mockResolvedValue(draftDoc([{ _id: "666666666666666666666666" }]));

    const res = createRes();
    await Controller.approve(createReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].warnings).toEqual([]);
  });

  test("har o'qituvchi yozuvi uchun alohida tekshiriladi", async () => {
    validateMaxOverload.mockResolvedValue(null);
    WorkloadDistribution.findOne = jest
      .fn()
      .mockResolvedValue(draftDoc([{ _id: "a1" }, { _id: "a2" }, { _id: "a3" }]));

    await Controller.approve(createReq(), createRes(), jest.fn());

    expect(validateMaxOverload).toHaveBeenCalledTimes(3);
  });

  test("REGRESSION-GUARD: ogohlantirish 400 ga aylantirilmasin", async () => {
    validateMaxOverload.mockResolvedValue({
      teacherEntryId: "x",
      severity: "warning",
      message: "Ortiqcha yuklama",
    });
    WorkloadDistribution.findOne = jest
      .fn()
      .mockResolvedValue(draftDoc([{ _id: "x" }]));

    const res = createRes();
    const next = jest.fn();
    await Controller.approve(createReq(), res, next);

    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  test("min-soat xatosi esa HAMON bloklaydi (400) — ikkisi aralashmasin", async () => {
    validateTeacherMinHours.mockResolvedValue([
      { teacherEntryId: "y", message: "Min soat yetmadi" },
    ]);
    validateMaxOverload.mockResolvedValue(null);
    WorkloadDistribution.findOne = jest
      .fn()
      .mockResolvedValue(draftDoc([{ _id: "y" }]));

    const res = createRes();
    await Controller.approve(createReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("TZ 4.2.4 — min soat BLOKLOVCHI (pending yozuvlar ham tekshiriladi)", () => {
  test("REGRESSION-GUARD: submit `skipPending` UZATMASLIGI shart", async () => {
    validateMaxOverload.mockResolvedValue(null);
    WorkloadDistribution.findOne = jest
      .fn()
      .mockResolvedValue(draftDoc([{ _id: "z", acceptanceStatus: "pending" }]));

    await Controller.approve(createReq(), createRes(), jest.fn());

    expect(validateTeacherMinHours).toHaveBeenCalledTimes(1);
    const opts = validateTeacherMinHours.mock.calls[0][1];
    expect(opts?.skipPending).not.toBe(true);
  });

  test("javobda qaysi o'qituvchi yetishmayotgani `errors[]` bilan qaytadi", async () => {
    const shortage = {
      teacherEntryId: "z",
      totalHour: 180,
      minHour: 400,
      shortage: 220,
      message: "Min soat shartiga rioya qilinmagan: 180 < 400 (assistant × 1)",
      severity: "error",
    };
    validateTeacherMinHours.mockResolvedValue([shortage]);
    validateMaxOverload.mockResolvedValue(null);
    WorkloadDistribution.findOne = jest
      .fn()
      .mockResolvedValue(draftDoc([{ _id: "z", acceptanceStatus: "pending" }]));

    const res = createRes();
    await Controller.approve(createReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].errors).toEqual([shortage]);
  });

  test("bloklanganda status O'ZGARMAYDI va hujjat saqlanmaydi", async () => {
    validateTeacherMinHours.mockResolvedValue([
      { teacherEntryId: "z", message: "Min soat yetmadi" },
    ]);
    validateMaxOverload.mockResolvedValue(null);
    const doc = draftDoc([{ _id: "z", acceptanceStatus: "pending" }]);
    WorkloadDistribution.findOne = jest.fn().mockResolvedValue(doc);

    await Controller.approve(createReq(), createRes(), jest.fn());

    expect(doc.status).toBe("draft");
    expect(doc.save).not.toHaveBeenCalled();
  });
});

describe("Faza 2 — submit: suitabilityWarnings[] (mavjud warnings[] TEGILMAGAN)", () => {
  test("kross-kafedra blok bo'lsa — suitabilityWarnings[] javobda keladi, submit TO'XTAMAYDI", async () => {
    validateMaxOverload.mockResolvedValue(null);
    const teachers = [
      {
        _id: "t1",
        acceptanceStatus: "pending",
        blocks: [
          {
            _id: "b1",
            suitability: { flag: "crossDepartment" },
            justification: { basis: "ish_tajribasi" },
          },
          { _id: "b2", suitability: { flag: "match" } },
        ],
      },
    ];
    WorkloadDistribution.findOne = jest.fn().mockResolvedValue(draftDoc(teachers));

    const res = createRes();
    await Controller.approve(createReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.action).toBe("submitted");
    expect(payload.suitabilityWarnings).toEqual([
      {
        type: "suitability",
        severity: "warning",
        teacherEntryId: "t1",
        blockId: "b1",
        flag: "crossDepartment",
        declared: true,
        basis: "ish_tajribasi",
      },
    ]);
  });

  test("kross-kafedra blok yo'q — suitabilityWarnings[] bo'sh massiv", async () => {
    validateMaxOverload.mockResolvedValue(null);
    const teachers = [
      { _id: "t1", acceptanceStatus: "pending", blocks: [{ _id: "b1", suitability: { flag: "match" } }] },
    ];
    WorkloadDistribution.findOne = jest.fn().mockResolvedValue(draftDoc(teachers));

    const res = createRes();
    await Controller.approve(createReq(), res, jest.fn());

    expect(res.json.mock.calls[0][0].suitabilityWarnings).toEqual([]);
  });

  test("REGRESSION-GUARD: mavjud `warnings[]` (ortiqcha yuklama) suitabilityWarnings bilan ARALASHMAYDI", async () => {
    const overloadWarning = {
      teacherEntryId: "t1",
      severity: "warning",
      message: "Ortiqcha yuklama",
    };
    validateMaxOverload.mockResolvedValue(overloadWarning);
    const teachers = [
      {
        _id: "t1",
        acceptanceStatus: "pending",
        blocks: [{ _id: "b1", suitability: { flag: "crossDepartment" } }],
      },
    ];
    WorkloadDistribution.findOne = jest.fn().mockResolvedValue(draftDoc(teachers));

    const res = createRes();
    await Controller.approve(createReq(), res, jest.fn());

    const payload = res.json.mock.calls[0][0];
    expect(payload.warnings).toEqual([overloadWarning]);
    expect(payload.suitabilityWarnings).toHaveLength(1);
    expect(payload.suitabilityWarnings[0].blockId).toBe("b1");
  });
});
