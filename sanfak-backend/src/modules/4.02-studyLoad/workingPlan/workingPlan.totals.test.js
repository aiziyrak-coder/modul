jest.mock("#shared/pythonParser", () => ({
  parseReja: jest.fn(),
  fileUrlToPath: jest.fn(),
}));
jest.mock("#references/_services/educationActivityResolver", () => ({
  enrichMetaWithSlugRefs: jest.fn(),
  populateAllSlugRefs: jest.fn().mockResolvedValue(undefined),
}));

const WorkingPlanModel = require("./workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const Controller = require("./workingPlan.controller");

const { computeSemesterTotals } = WorkingPlanModel;

const staleSemester = () => ({
  semester: "1",
  blocks: [
    {
      blockCode: "MFI",
      title: "Majburiy fanlar",
      sciences: [
        {
          code: "OT101",
          totalCredit: 6,
          weeklyHours: 4,
          particle: [
            {
              slug: "umumiy_yuklamaning_hajmi_soat",
              title: "Umumiy",
              value: 180,
            },
            { slug: "maruza", title: "Ma'ruza", value: 30 },
          ],
        },
      ],
    },
  ],
  blocksTotal: {
    title: "Jami",
    totalHour: 1,
    totalCredit: 1,
    weeklyHours: 1,
    particles: [],
  },
  practice: { hour: 20, credit: 2, particles: [] },
  grandTotal: {
    title: "Jami semestrda",
    totalHour: 1,
    totalCredit: 1,
    weeklyHours: 1,
    particles: [],
  },
});

describe("computeSemesterTotals — tanlov kvotasi sloti (ADR-032)", () => {
  test("slot krediti/soati/particle'i blocksTotal'ga qo'shiladi", () => {
    const { EMPTY_SLOT_TITLE } = require("#modules/4.02-studyLoad/_shared/planRowType");
    const sem = staleSemester();
    sem.blocks.push({
      blockCode: "TF2",
      title: "Tanlov fanlar",
      sciences: [
        {
          serialNumber: "2.01",
          code: null,
          science: null,
          title: EMPTY_SLOT_TITLE,
          totalCredit: 5,
          weeklyHours: 5,
          particle: [
            { slug: "soat", canonical: "hour", title: "soat", value: 150 },
            { slug: "jami", canonical: "total", title: "Jami", value: 75 },
          ],
        },
      ],
    });
    computeSemesterTotals(sem);
    expect(sem.blocksTotal.totalCredit).toBe(11);
    expect(sem.blocksTotal.weeklyHours).toBe(9);
    expect(sem.blocksTotal.totalHour).toBe(330);
    const bySlug = Object.fromEntries(sem.blocksTotal.particles.map((p) => [p.slug, p.value]));
    expect(bySlug.jami).toBe(75);
  });
});

describe("computeSemesterTotals — yig'indilar fanlardan qayta hisoblanadi", () => {
  test("blocksTotal eski qiymatdan fanlar yig'indisiga almashadi", () => {
    const sem = staleSemester();
    computeSemesterTotals(sem);

    expect(sem.blocksTotal.totalHour).toBe(180);
    expect(sem.blocksTotal.totalCredit).toBe(6);
    expect(sem.blocksTotal.weeklyHours).toBe(4);
  });

  test("particle'lar slug bo'yicha yig'iladi", () => {
    const sem = staleSemester();
    computeSemesterTotals(sem);

    const bySlug = Object.fromEntries(
      sem.blocksTotal.particles.map((p) => [p.slug, p.value]),
    );
    expect(bySlug.umumiy_yuklamaning_hajmi_soat).toBe(180);
    expect(bySlug.maruza).toBe(30);
  });

  test("grandTotal = blocksTotal + malakaviy amaliyot", () => {
    const sem = staleSemester();
    computeSemesterTotals(sem);

    expect(sem.grandTotal.totalHour).toBe(200);
    expect(sem.grandTotal.totalCredit).toBe(8);
  });

  test("oxirgi semestrda ham sarlavha 'Jami semestrda' bo'lib qoladi", () => {
    const sem = staleSemester();
    computeSemesterTotals(sem, true);
    expect(sem.grandTotal.title).toBe("Jami semestrda");
  });

  test("fan soati kamaysa yig'indi ham kamayadi (eski qiymat qolmaydi)", () => {
    const sem = staleSemester();
    computeSemesterTotals(sem);
    expect(sem.blocksTotal.totalHour).toBe(180);

    sem.blocks[0].sciences[0].particle[0].value = 120;
    computeSemesterTotals(sem);
    expect(sem.blocksTotal.totalHour).toBe(120);
    expect(sem.grandTotal.totalHour).toBe(140);
  });
});

const PLAN_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const WS_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const BLOCK_ID = "111111111111111111111111";
const SCIENCE_ID = "222222222222222222222222";
const PART_ID = "333333333333333333333333";

const mockLean = (value) => ({ lean: jest.fn().mockResolvedValue(value) });
const mockSelectLean = (value) => ({
  select: jest
    .fn()
    .mockReturnValue({ lean: jest.fn().mockResolvedValue(value) }),
});
const mockSelectLeanExec = (value) => ({
  select: jest.fn().mockReturnValue({
    lean: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(value),
    }),
  }),
});

const makePlanDoc = () => {
  const part = {
    _id: PART_ID,
    slug: "umumiy_yuklamaning_hajmi_soat",
    value: 180,
  };
  const science = { _id: SCIENCE_ID, particle: [part], set: jest.fn() };
  return {
    _science: science,
    _part: part,
    semesters: new Map([
      ["1", { blocks: [{ _id: BLOCK_ID, sciences: [science] }] }],
    ]),
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
};

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makeReq = (body = {}) => ({
  params: { id: PLAN_ID },
  body: {
    semKey: "1",
    parentId: BLOCK_ID,
    _id: SCIENCE_ID,
    totalCredit: 8,
    ...body,
  },
  scope: {},
});

const wireFindOne = (planDoc) => {
  let call = 0;
  jest.spyOn(WorkingPlanModel, "findOne").mockImplementation(() => {
    call += 1;
    if (call === 1) return mockLean({ _id: PLAN_ID, workingSchedule: WS_ID });
    if (call === 2) return planDoc;
    return mockSelectLeanExec({ _id: PLAN_ID });
  });
  jest
    .spyOn(WorkingScheduleModel, "findById")
    .mockReturnValue(mockSelectLean({ status: "draft" }));
};

beforeEach(() => {
  jest.restoreAllMocks();
});

describe("updateStudyPlanScince — yig'indi qayta hisoblanadigan yo'l", () => {
  test("save() chaqiriladi va `semesters` markModified qilinadi (hook otiladi)", async () => {
    const planDoc = makePlanDoc();
    wireFindOne(planDoc);

    const next = jest.fn();
    const res = makeRes();
    await Controller.updateStudyPlanScince(makeReq(), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(planDoc.markModified).toHaveBeenCalledWith("semesters");
    expect(planDoc.save).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("hook otmaydigan `findOneAndUpdate`/`updateOne` YO'Q", async () => {
    const planDoc = makePlanDoc();
    wireFindOne(planDoc);
    const foau = jest.spyOn(WorkingPlanModel, "findOneAndUpdate");
    const upd = jest.spyOn(WorkingPlanModel, "updateOne");

    await Controller.updateStudyPlanScince(
      makeReq({
        particle: [{ _id: PART_ID, umumiy_yuklamaning_hajmi_soat: 120 }],
      }),
      makeRes(),
      jest.fn(),
    );

    expect(foau).not.toHaveBeenCalled();
    expect(upd).not.toHaveBeenCalled();
  });

  test("fan maydonlari va particle qiymati hujjat ustida o'zgaradi", async () => {
    const planDoc = makePlanDoc();
    wireFindOne(planDoc);

    await Controller.updateStudyPlanScince(
      makeReq({
        particle: [{ _id: PART_ID, umumiy_yuklamaning_hajmi_soat: 120 }],
      }),
      makeRes(),
      jest.fn(),
    );

    expect(planDoc._science.set).toHaveBeenCalledWith("totalCredit", 8);
    expect(planDoc._part.value).toBe(120);
  });

});

describe("updateStudyPlanScince — bo'sh slot qatori (ADR-032)", () => {
  test("slot qatoriga PUT → 400, save() chaqirilmaydi", async () => {
    const planDoc = makePlanDoc();
    const { EMPTY_SLOT_TITLE } = require("#modules/4.02-studyLoad/_shared/planRowType");
    Object.assign(planDoc._science, { title: EMPTY_SLOT_TITLE, code: null, science: null });
    wireFindOne(planDoc);

    const res = makeRes();
    await Controller.updateStudyPlanScince(makeReq({ totalCredit: 9 }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(/Fan tanlash/);
    expect(planDoc.save).not.toHaveBeenCalled();
  });

  test("oddiy qatorga slot NOMI berilsa → 400 (identitet soxtalanmaydi)", async () => {
    const planDoc = makePlanDoc();
    const { EMPTY_SLOT_TITLE } = require("#modules/4.02-studyLoad/_shared/planRowType");
    wireFindOne(planDoc);

    const res = makeRes();
    await Controller.updateStudyPlanScince(makeReq({ title: EMPTY_SLOT_TITLE, code: "" }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(/tizim nomi/);
    expect(planDoc.save).not.toHaveBeenCalled();
  });
});

describe("updateStudyPlanScince — 404 va doira", () => {
  test("mos fan qatori topilmasa 404 (ilgari jimgina 200 qaytardi)", async () => {
    const planDoc = makePlanDoc();
    wireFindOne(planDoc);

    const res = makeRes();
    await Controller.updateStudyPlanScince(
      makeReq({ _id: "999999999999999999999999" }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(planDoc.save).not.toHaveBeenCalled();
  });

  test("yozuv uchun o'qish ham `req.scope` bilan cheklanadi", async () => {
    const planDoc = makePlanDoc();
    wireFindOne(planDoc);

    const req = makeReq();
    req.scope = { workingSchedule: { $in: ["ws-1"] } };
    await Controller.updateStudyPlanScince(req, makeRes(), jest.fn());

    expect(WorkingPlanModel.findOne.mock.calls[1][0]).toEqual({
      _id: PLAN_ID,
      workingSchedule: { $in: ["ws-1"] },
    });
  });
});
