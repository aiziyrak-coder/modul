const mongoose = require("mongoose");
const { ROLES } = require("#config/constants");

const ScienceProgram = require("./scienceProgram.model");
const WorkingPlan = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const Controller = require("./scienceProgram.controller");

const SCIENCE_ID = new mongoose.Types.ObjectId();
const OTHER_SCIENCE_ID = new mongoose.Types.ObjectId();
const WS_ID = new mongoose.Types.ObjectId();
const AY_ID = new mongoose.Types.ObjectId();

const particleOf = ({
  hour,
  total,
  lecture,
  seminar,
  lab,
  practical,
  independent,
}) =>
  [
    hour != null && {
      slug: "soat",
      title: "soat",
      canonical: "hour",
      value: hour,
    },
    { slug: "foiz", title: "%", canonical: "percent", value: 0 },
    { slug: "jami", title: "Jami", canonical: "total", value: total },
    { slug: "maruza", title: "Ma'ruza", canonical: "lecture", value: lecture },
    {
      slug: "amaliy_mashg_ulot",
      title: "Amaliy",
      canonical: "practical",
      value: practical,
    },
    {
      slug: "laboratoriya_mashg_uloti",
      title: "Laboratoriya",
      canonical: "laboratory",
      value: lab,
    },
    { slug: "seminar", title: "Seminar", canonical: "seminar", value: seminar },
    {
      slug: "mustaqil_ta_lim",
      title: "Mustaqil",
      canonical: "independent",
      value: independent,
    },
  ].filter(Boolean);

const LIVE_ROW = {
  hour: 120,
  total: 60,
  lecture: 30,
  seminar: 30,
  lab: 0,
  practical: 0,
  independent: 60,
};

const planOf = ({
  science = SCIENCE_ID,
  particle = particleOf(LIVE_ROW),
  label = "wp",
} = {}) => ({
  label,
  workingSchedule: { academicYear: AY_ID },
  semesters: new Map([
    [
      "1",
      {
        blocks: [
          {
            blockCode: "MFI",
            title: "Majburiy fanlar",
            sciences: [
              {
                science,
                serialNumber: "1.01",
                code: "FA120",
                totalCredit: 4,
                weeklyHours: 2,
                particle,
              },
            ],
          },
        ],
      },
    ],
  ]),
});

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makeReq = (body = {}) => ({
  body: { science: String(SCIENCE_ID), ...body },
  user: {
    _id: new mongoose.Types.ObjectId(),
    role: { title: ROLES.SUPER_ADMIN },
  },
});

const wire = ({ scheduleIds = [WS_ID], plans = [] } = {}) => {
  const schedFind = jest
    .spyOn(WorkingScheduleModel, "find")
    .mockReturnValue({ distinct: jest.fn().mockResolvedValue(scheduleIds) });

  const chain = {};
  chain.sort = jest.fn(() => chain);
  chain.populate = jest.fn(() => chain);
  chain.exec = jest.fn().mockResolvedValue(plans);
  const planFind = jest.spyOn(WorkingPlan, "find").mockReturnValue(chain);

  const planFindOne = jest.spyOn(WorkingPlan, "findOne").mockReturnValue({
    populate: jest.fn(() => ({
      exec: jest.fn().mockResolvedValue(plans[0] || null),
    })),
  });

  return { schedFind, planFind, planFindOne, chain };
};

const run = async (wired, body = {}) => {
  let captured = null;
  jest
    .spyOn(ScienceProgram.prototype, "save")
    .mockImplementation(function saveMock() {
      captured = this;
      return Promise.resolve(this);
    });
  const res = makeRes();
  const next = jest.fn();
  await Controller.addScienceProgram(makeReq(body), res, next);
  return { captured, res, next, ...wired };
};

beforeEach(() => {
  jest.restoreAllMocks();
});

describe("resolveWorkingPlan — approved workingSchedule orqali", () => {
  test("status `workingSchedule` da so'raladi (`workingPlan` da emas)", async () => {
    const { schedFind } = await run(wire({ plans: [planOf()] }));
    expect(schedFind).toHaveBeenCalledWith({ status: "approved" });
  });

  test("reja filtri — faqat `workingSchedule: {$in}` (eski buzuq kalitlar YO'Q)", async () => {
    const { planFind } = await run(wire({ plans: [planOf()] }));
    const filter = planFind.mock.calls[0][0];

    expect(filter).toEqual({ workingSchedule: { $in: [WS_ID] } });
    expect(filter).not.toHaveProperty("blocks.sciences.science");
    expect(filter).not.toHaveProperty("status");
  });

  test("fan topiladi va autoFields to'ladi (ilgari HAR DOIM null edi)", async () => {
    const { captured, res } = await run(wire({ plans: [planOf()] }));

    expect(res.status).toHaveBeenCalledWith(201);
    expect(captured.code).toBe("FA120");
    expect(captured.moduleType).toBe("Majburiy");
    expect(captured.serialNumber).toBe("1.01");
    expect(String(captured.academicYear)).toBe(String(AY_ID));
  });

  test("tanlov determinatik — `createdAt` kamayish tartibida saralanadi", async () => {
    const { chain } = await run(wire({ plans: [planOf()] }));
    expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
  });

  test("bir nechta reja: fan bor BIRINCHI (eng yangi) reja tanlanadi", async () => {
    const newestWithoutScience = planOf({
      science: OTHER_SCIENCE_ID,
      label: "yangi-lekin-fansiz",
    });
    const older = planOf({ label: "eskiroq-lekin-fanli" });

    const { captured } = await run(
      wire({ plans: [newestWithoutScience, older] }),
    );
    expect(captured.code).toBe("FA120");
    expect(captured.credits).toBe(4);
  });

  test("`workingPlanId` berilsa — jadval umuman so'ralmaydi", async () => {
    const wired = wire({ plans: [planOf()] });
    const { captured, schedFind, planFind, planFindOne } = await run(wired, {
      workingPlanId: String(new mongoose.Types.ObjectId()),
    });

    expect(planFindOne).toHaveBeenCalledTimes(1);
    expect(schedFind).not.toHaveBeenCalled();
    expect(planFind).not.toHaveBeenCalled();
    expect(captured.code).toBe("FA120");
  });
});

describe("REGRESSIYA QULFI — topilmasa mavjud xatti-harakat saqlanadi", () => {
  test("approved jadval yo'q — reja qidirilmaydi, 201 + null maydonlar", async () => {
    const { captured, res, next, planFind } = await run(
      wire({ scheduleIds: [], plans: [] }),
    );

    expect(planFind).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(captured.code).toBeNull();
    expect(captured.totalHours).toBeNull();
    expect(captured.moduleType).toBeNull();
  });

  test("reja bor, lekin fan yo'q — xato TASHLANMAYDI, 201", async () => {
    const { captured, res, next } = await run(
      wire({ plans: [planOf({ science: OTHER_SCIENCE_ID })] }),
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(captured.moduleType).toBeNull();
    expect(captured.hourItems).toHaveLength(0);
  });
});

describe("soat semantikasi — jonli jadval (120 | 60 | 30 | 30 | 60)", () => {
  test("totalHours = `soat` (UMUMIY yuklama)", async () => {
    const { captured } = await run(wire({ plans: [planOf()] }));
    expect(captured.totalHours).toBe(120);
  });

  test("classroomHours = `jami` (AUDITORIYA) — ayirma EMAS", async () => {
    const { captured } = await run(wire({ plans: [planOf()] }));
    expect(captured.classroomHours).toBe(60);
    expect(captured.classroomHours).not.toBeNull();
  });

  test("independentHours O'ZGARMAYDI", async () => {
    const { captured } = await run(wire({ plans: [planOf()] }));
    expect(captured.independentHours).toBe(60);
  });

  test("munosabat saqlanadi: totalHours === classroomHours + independentHours", async () => {
    const { captured } = await run(wire({ plans: [planOf()] }));
    expect(captured.totalHours).toBe(
      captured.classroomHours + captured.independentHours,
    );
  });

  test("LEGACY: `soat` particle'i yo'q — totalHours eski xulqqa (`jami`) tushadi", async () => {
    const legacy = particleOf({ ...LIVE_ROW, hour: null });
    const { captured } = await run(
      wire({ plans: [planOf({ particle: legacy })] }),
    );

    expect(captured.totalHours).toBe(60);
    expect(captured.classroomHours).toBe(60);
  });

  test("'Malakaviy amaliyot' shakli (total=0, indep=0, hour=60)", async () => {
    const practice = particleOf({
      hour: 60,
      total: 0,
      lecture: 0,
      seminar: 0,
      lab: 0,
      practical: 0,
      independent: 0,
    });
    const { captured } = await run(
      wire({ plans: [planOf({ particle: practice })] }),
    );

    expect(captured.totalHours).toBe(60);
    expect(captured.classroomHours).toBeNull();
    expect(captured.independentHours).toBeNull();
  });
});
