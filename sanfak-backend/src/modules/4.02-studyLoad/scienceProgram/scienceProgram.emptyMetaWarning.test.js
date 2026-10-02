const mongoose = require("mongoose");
const { ROLES } = require("#config/constants");

const ScienceProgram = require("./scienceProgram.model");
const WorkingPlan = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const Controller = require("./scienceProgram.controller");

const SCIENCE_ID = new mongoose.Types.ObjectId();
const AY_ID = new mongoose.Types.ObjectId();
const WS_ID = new mongoose.Types.ObjectId();

const wpFixture = () => ({
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
                science: SCIENCE_ID,
                serialNumber: "1.2.06",
                code: "AN11-312",
                totalCredit: 4,
                weeklyHours: 4,
                particle: [
                  { slug: "soat", canonical: "hour", value: 120 },
                  { slug: "jami", canonical: "total", value: 60 },
                  { slug: "maruza", canonical: "lecture", value: 12 },
                ],
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

const superUser = () => ({
  _id: new mongoose.Types.ObjectId(),
  role: { title: ROLES.SUPER_ADMIN },
});

const wireLookup = (plans) => {
  jest.spyOn(WorkingScheduleModel, "find").mockReturnValue({
    distinct: jest.fn().mockResolvedValue([WS_ID]),
  });
  const chain = {};
  chain.sort = jest.fn(() => chain);
  chain.populate = jest.fn(() => chain);
  chain.exec = jest.fn().mockResolvedValue(plans);
  jest.spyOn(WorkingPlan, "find").mockReturnValue(chain);
  return chain;
};

const runCreate = async (wp) => {
  wireLookup(wp ? [wp] : []);
  jest
    .spyOn(ScienceProgram.prototype, "save")
    .mockImplementation(function saveMock() {
      return Promise.resolve(this);
    });

  const res = makeRes();
  const next = jest.fn();
  await Controller.addScienceProgram(
    { body: { science: String(SCIENCE_ID) }, user: superUser() },
    res,
    next,
  );
  return { res, next, payload: res.json.mock.calls[0]?.[0] };
};

const runStatus = async (wp, science = String(SCIENCE_ID)) => {
  wireLookup(wp ? [wp] : []);
  const res = makeRes();
  const next = jest.fn();
  await Controller.getWorkingPlanStatus({ query: { science } }, res, next);
  return { res, next, payload: res.json.mock.calls[0]?.[0] };
};

beforeEach(() => {
  jest.restoreAllMocks();
});

describe("POST / — reja topilmasa ogohlantirish qaytadi", () => {
  test("tasdiqlangan reja YO'Q → 201 + `warning`", async () => {
    const { res, next, payload } = await runCreate(null);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(typeof payload.warning).toBe("string");
    expect(payload.warning).toMatch(/ishchi o'quv reja topilmadi/);
  });

  test("REGRESSIYA: reja topilmasa ham yaratish BLOKLANMAYDI", async () => {
    const { res, next, payload } = await runCreate(null);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(payload.message).toBe("Fan dasturi yaratildi");
    expect(payload._id).toBeDefined();
  });

  test("reja TOPILDI → javobda `warning` maydoni umuman yo'q", async () => {
    const { res, payload } = await runCreate(wpFixture());

    expect(res.status).toHaveBeenCalledWith(201);
    expect(payload).not.toHaveProperty("warning");
  });
});

describe("GET /working-plan-status", () => {
  test("reja YO'Q → { hasWorkingPlan: false, warning: <matn> }", async () => {
    const { res, next, payload } = await runStatus(null);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(payload.hasWorkingPlan).toBe(false);
    expect(typeof payload.warning).toBe("string");
  });

  test("reja BOR → { hasWorkingPlan: true, warning: null }", async () => {
    const { payload } = await runStatus(wpFixture());

    expect(payload.hasWorkingPlan).toBe(true);
    expect(payload.warning).toBeNull();
  });

  test("ogohlantirish matni yaratish javobi bilan AYNAN bir xil", async () => {
    const created = await runCreate(null);
    const status = await runStatus(null);

    expect(status.payload.warning).toBe(created.payload.warning);
  });

  test("science berilmasa → 400 (ErrorHandler)", async () => {
    const res = makeRes();
    const next = jest.fn();
    await Controller.getWorkingPlanStatus({ query: {} }, res, next);

    expect(res.json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0].statusCode).toBe(400);
  });

  test("science noto'g'ri formatda → 400 (CastError emas)", async () => {
    const res = makeRes();
    const next = jest.fn();
    await Controller.getWorkingPlanStatus(
      { query: { science: "not-an-objectid" } },
      res,
      next,
    );

    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0].statusCode).toBe(400);
  });
});
