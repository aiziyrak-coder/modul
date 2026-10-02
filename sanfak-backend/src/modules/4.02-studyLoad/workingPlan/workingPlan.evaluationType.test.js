const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
const AssessmentTypeModel = require("#references/assessmentType/assessmentType.model");

const service = require("./workingPlan.service");
const {
  updateWorkingPlanScienceSchema,
} = require("./workingPlan.validation");

const PLAN_ID = "aaaaaaaaaaaaaaaaaaaaaa01";
const WS_ID = "bbbbbbbbbbbbbbbbbbbbbb01";
const SP_ID = "cccccccccccccccccccccc01";
const SCI_ID = "333333333333333333333301";
const AT_ID = "999999999999999999999901";
const BLOCK_ID = "111111111111111111111101";
const ROW_ID = "222222222222222222222201";

const mockSelectLean = (value) => ({
  select: jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue(value),
  }),
});

const makeRow = (over = {}) => ({
  _id: ROW_ID,
  code: "F-01",
  title: "Tibbiy va biologik fizika",
  science: SCI_ID,
  evaluationType: null,
  ...over,
});

const makePlan = (over = {}) => ({
  _id: PLAN_ID,
  workingSchedule: WS_ID,
  studyPlan: over.studyPlan === undefined ? SP_ID : over.studyPlan,
});

const makeStudyPlan = (semKeys = ["3", "4"]) => {
  const semesters = new Map(
    semKeys.map((k) => [k, { hour: 60, credit: 2, assessmentType: null }]),
  );
  const row = { _id: "888888888888888888888801", code: "F-01", science: SCI_ID, semesters };
  return {
    _id: SP_ID,
    blocks: [{ blockCode: "MFI", sciences: [row] }],
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
    _row: row,
  };
};

const expectReject = async (promise, statusCode) => {
  let caught = null;
  try {
    await promise;
  } catch (err) {
    caught = err;
  }
  expect(caught).not.toBeNull();
  expect(caught.statusCode).toBe(statusCode);
  return caught;
};

afterEach(() => jest.restoreAllMocks());

describe("updateWorkingPlanScienceSchema — evaluationType", () => {
  const base = { semKey: "1", parentId: BLOCK_ID, _id: ROW_ID };

  test("lug'at `_id` (24-hex) qabul qilinadi", () => {
    expect(
      updateWorkingPlanScienceSchema.validate({
        ...base,
        evaluationType: AT_ID,
      }).error,
    ).toBeUndefined();
  });

  test("`\"\"` va `null` — tozalash, qabul qilinadi", () => {
    expect(
      updateWorkingPlanScienceSchema.validate({ ...base, evaluationType: "" })
        .error,
    ).toBeUndefined();
    expect(
      updateWorkingPlanScienceSchema.validate({ ...base, evaluationType: null })
        .error,
    ).toBeUndefined();
  });

  test("ERKIN MATN RAD etiladi (ilgari o'tardi)", () => {
    expect(
      updateWorkingPlanScienceSchema.validate({
        ...base,
        evaluationType: "sinov",
      }).error,
    ).toBeDefined();
  });

  test("legacy `smester.evaluationType` ham AYNI cheklovda", () => {
    expect(
      updateWorkingPlanScienceSchema.validate({
        ...base,
        smester: { evaluationType: "imtihon" },
      }).error,
    ).toBeDefined();
    expect(
      updateWorkingPlanScienceSchema.validate({
        ...base,
        smester: { evaluationType: AT_ID },
      }).error,
    ).toBeUndefined();
  });
});

describe("resolveAssessmentTypeTitle", () => {
  test("lug'atdagi `title` qaytadi (MATN, ObjectId EMAS)", async () => {
    jest
      .spyOn(AssessmentTypeModel, "findById")
      .mockReturnValue(mockSelectLean({ title: "imtihon (yozma)" }));

    await expect(service.resolveAssessmentTypeTitle(AT_ID)).resolves.toBe(
      "imtihon (yozma)",
    );
  });

  test("`\"\"`/`null` — tozalash, lug'at UMUMAN o'qilmaydi", async () => {
    const spy = jest.spyOn(AssessmentTypeModel, "findById");

    await expect(service.resolveAssessmentTypeTitle("")).resolves.toBeNull();
    await expect(service.resolveAssessmentTypeTitle(null)).resolves.toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  test("noma'lum `_id` — 404 (jimgina `null` bo'lib ketmaydi)", async () => {
    jest
      .spyOn(AssessmentTypeModel, "findById")
      .mockReturnValue(mockSelectLean(null));

    await expectReject(service.resolveAssessmentTypeTitle(AT_ID), 404);
  });
});

describe("toGlobalSemKey", () => {
  const { toGlobalSemKey } = service._internals;

  test("1-kurs: 1->1, 2->2", () => {
    expect(toGlobalSemKey("1", 1)).toBe("1");
    expect(toGlobalSemKey("2", 1)).toBe("2");
  });

  test("2-kurs: 1->3, 2->4 · 6-kurs: 1->11, 2->12", () => {
    expect(toGlobalSemKey("1", 2)).toBe("3");
    expect(toGlobalSemKey("2", 2)).toBe("4");
    expect(toGlobalSemKey("1", 6)).toBe("11");
    expect(toGlobalSemKey("2", 6)).toBe("12");
  });

  test("kurs raqami yo'q/noto'g'ri — `null` (taxmin qilinmaydi)", () => {
    expect(toGlobalSemKey("1", undefined)).toBeNull();
    expect(toGlobalSemKey("1", 0)).toBeNull();
    expect(toGlobalSemKey("x", 2)).toBeNull();
  });
});

describe("prepareEvaluationTypeWriteThrough — nishon aniq bo'lsin", () => {
  test("`workingPlan.studyPlan === null` — 400 (eski hujjat)", async () => {
    await expectReject(
      service.prepareEvaluationTypeWriteThrough({
        plan: makePlan({ studyPlan: null }),
        semKey: "1",
        row: makeRow(),
      }),
      400,
    );
  });

  test("ota hujjatda kurs raqami yo'q — 400", async () => {
    jest
      .spyOn(WorkingScheduleModel, "findById")
      .mockReturnValue(mockSelectLean({ currentCourse: null }));

    await expectReject(
      service.prepareEvaluationTypeWriteThrough({
        plan: makePlan(),
        semKey: "1",
        row: makeRow(),
      }),
      400,
    );
  });

  test("manbada mos fan qatori yo'q — 400 (ishchi rejaga ham yozilmaydi)", async () => {
    jest
      .spyOn(WorkingScheduleModel, "findById")
      .mockReturnValue(mockSelectLean({ currentCourse: 2 }));
    const studyPlan = makeStudyPlan();
    studyPlan.blocks[0].sciences[0].science = "444444444444444444444401";
    studyPlan.blocks[0].sciences[0].code = "BOSHQA";
    jest.spyOn(StudyPlanModel, "findById").mockResolvedValue(studyPlan);

    await expectReject(
      service.prepareEvaluationTypeWriteThrough({
        plan: makePlan(),
        semKey: "1",
        row: makeRow(),
      }),
      400,
    );
  });

  test("qatorda AYNI global semestr yo'q — 400", async () => {
    jest
      .spyOn(WorkingScheduleModel, "findById")
      .mockReturnValue(mockSelectLean({ currentCourse: 2 }));
    jest
      .spyOn(StudyPlanModel, "findById")
      .mockResolvedValue(makeStudyPlan(["1", "2"]));

    await expectReject(
      service.prepareEvaluationTypeWriteThrough({
        plan: makePlan(),
        semKey: "1",
        row: makeRow(),
      }),
      400,
    );
  });

  test("mos qator topiladi — global kalit 2-kurs uchun \"3\"", async () => {
    jest
      .spyOn(WorkingScheduleModel, "findById")
      .mockReturnValue(mockSelectLean({ currentCourse: 2 }));
    jest.spyOn(StudyPlanModel, "findById").mockResolvedValue(makeStudyPlan());

    const prepared = await service.prepareEvaluationTypeWriteThrough({
      plan: makePlan(),
      semKey: "1",
      row: makeRow(),
    });

    expect(prepared.globalSemKey).toBe("3");
    expect(prepared.spRows).toHaveLength(1);
  });
});

describe("commitEvaluationTypeWriteThrough", () => {
  const arrange = async () => {
    jest
      .spyOn(WorkingScheduleModel, "findById")
      .mockReturnValue(mockSelectLean({ currentCourse: 2 }));
    const studyPlan = makeStudyPlan();
    jest.spyOn(StudyPlanModel, "findById").mockResolvedValue(studyPlan);
    const prepared = await service.prepareEvaluationTypeWriteThrough({
      plan: makePlan(),
      semKey: "1",
      row: makeRow(),
    });
    return { prepared, studyPlan };
  };

  test("manba `studyPlan.semesters.3.assessmentType` MATN bilan yangilanadi", async () => {
    const { prepared, studyPlan } = await arrange();

    const res = await service.commitEvaluationTypeWriteThrough(
      prepared,
      "imtihon (test)",
    );

    expect(studyPlan._row.semesters.get("3").assessmentType).toBe(
      "imtihon (test)",
    );
    expect(studyPlan._row.semesters.get("4").assessmentType).toBeNull();
    expect(studyPlan.save).toHaveBeenCalledTimes(1);
    expect(studyPlan.markModified).toHaveBeenCalledWith("blocks");
    expect(res.persisted).toBe(true);
    expect(res.semKey).toBe("3");
  });

  test("`null` — qiymat tozalanadi", async () => {
    const { prepared, studyPlan } = await arrange();

    await service.commitEvaluationTypeWriteThrough(prepared, null);

    expect(studyPlan._row.semesters.get("3").assessmentType).toBeNull();
  });

  test("manba yozuvi yiqilsa — OCHIQ bayroq (`persisted: false`)", async () => {
    const { prepared, studyPlan } = await arrange();
    studyPlan.save.mockRejectedValue(new Error("E11000 duplicate"));

    const res = await service.commitEvaluationTypeWriteThrough(
      prepared,
      "sinov",
    );

    expect(res.persisted).toBe(false);
    expect(res.persistError).toContain("E11000");
  });
});
