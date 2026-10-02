jest.mock("./personalWorkPlan.model");
jest.mock("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
jest.mock("#references/science/science.model");
jest.mock("#references/academicYear/academicYear.model");

const PersonalWorkPlanModel = require("./personalWorkPlan.model");
const WorkloadDistribution = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const ScienceModel = require("#references/science/science.model");
const Controller = require("./personalWorkPlan.controller");

const ME = "aaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER = "999999999999999999999999";
const AY = "bbbbbbbbbbbbbbbbbbbbbbbb";
const BLOCK_ID = "123412341234123412341234";

const defectBlock = {
  _id: BLOCK_ID,
  science: "cccccccccccccccccccccccc",
  practiceTitle: null,
  course: 2,
  totalHour: 226,
  studyWork: {
    semester: 3,
    stream: 1,
    group: 8,
    classTypes: [{ slug: "maruza", total: 24 }, { slug: "amaliy", total: 192 }],
    items: [{ slug: "on", value: 0 }, { slug: "yan", value: 0 }, { slug: "qoldirilgan", value: 10 }, { slug: "malakaviy", value: 0 }],
  },
};

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const arrange = (existingPlan) => {
  WorkloadDistribution.find = jest.fn().mockResolvedValue([
    {
      _id: "eeeeeeeeeeeeeeeeeeeeeeee",
      teachers: [{ _id: "ffffffffffffffffffffffff", teacher: { toString: () => ME }, acceptanceStatus: "accepted", isVacant: false, stavka: 0.5, blocks: [defectBlock] }],
    },
  ]);
  ScienceModel.find = jest.fn().mockReturnValue({ select: () => ({ lean: () => Promise.resolve([]) }) });
  PersonalWorkPlanModel.findOne = jest.fn().mockResolvedValue(existingPlan);
  const created = [];
  PersonalWorkPlanModel.mockImplementation((data) => {
    created.push(data);
    return { ...data, _id: "planid", save: jest.fn().mockResolvedValue(undefined) };
  });
  return created;
};

const generate = async (body = { academicYear: AY }) => {
  const res = createRes();
  await Controller.generateFromWorkload({ user: { _id: ME }, body }, res, jest.fn());
  return res;
};

beforeEach(() => jest.clearAllMocks());

describe("D-3b — I bo'lim qatori blanka ustunlari bilan saqlanadi", () => {
  test("qayta topshirish 10 soat o'z kalitida; oqim/guruh/blockId yoziladi; Σ = 226", async () => {
    const created = arrange(null);
    await generate();
    const sci = created[0].teachingLoad.sciences[0];
    expect(sci.hoursByType).toMatchObject({ lecture: 24, seminar: 192, retake: 10, on: 0, yan: 0, otherWork: 0, adjustment: 0 });
    expect(sci).toMatchObject({ streamCount: 1, groupCount: 8, blockId: BLOCK_ID, totalHour: 226 });
    const h = sci.hoursByType;
    const sum = h.lecture + h.seminar + h.laboratory + h.practical + h.on + h.yan + h.retake + h.practiceLead + h.otherWork + h.adjustment;
    expect(sum).toBe(226);
  });
});

describe("D-3b — /generate egasi va holat qulfi", () => {
  test("body'dagi boshqa o'qituvchi e'tiborsiz — reja so'rov yuboruvchi uchun izlanadi", async () => {
    arrange(null);
    await generate({ teacher: OTHER, academicYear: AY });
    expect(PersonalWorkPlanModel.findOne).toHaveBeenCalledWith(expect.objectContaining({ teacher: ME }));
    expect(PersonalWorkPlanModel.findOne).not.toHaveBeenCalledWith(expect.objectContaining({ teacher: OTHER }));
  });

  test.each([["submitted"], ["approved"], ["completed"]])("mavjud reja `%s` — 400, qayta yozilmaydi", async (status) => {
    const plan = { status, teachingLoad: {}, save: jest.fn() };
    arrange(plan);
    const res = await generate();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(plan.save).not.toHaveBeenCalled();
  });

  test.each([["draft"], ["rejected"]])("mavjud reja `%s` — I bo'lim yangilanadi", async (status) => {
    const plan = { status, teachingLoad: {}, save: jest.fn().mockResolvedValue(undefined) };
    arrange(plan);
    const res = await generate();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(plan.save).toHaveBeenCalled();
    expect(plan.teachingLoad.sciences[0].hoursByType.retake).toBe(10);
  });

  test("academicYear yo'q — 400", async () => {
    arrange(null);
    const res = await generate({});
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("generateWorkPlanSchema — /generate tanasi", () => {
  const { generateWorkPlanSchema } = require("./personalWorkPlan.validation");

  test("academicYear ObjectId — o'tadi; teacher qabul qilinadi (controller e'tiborsiz qoldiradi)", () => {
    expect(generateWorkPlanSchema.validate({ academicYear: AY, teacher: OTHER }).error).toBeUndefined();
  });

  test.each([
    ["operator obyekti", { academicYear: { $ne: null } }],
    ["academicYear yo'q", {}],
    ["noma'lum maydon", { academicYear: AY, teachingLoad: {} }],
  ])("%s — rad etiladi", (_n, body) => {
    expect(generateWorkPlanSchema.validate(body).error).toBeDefined();
  });
});
