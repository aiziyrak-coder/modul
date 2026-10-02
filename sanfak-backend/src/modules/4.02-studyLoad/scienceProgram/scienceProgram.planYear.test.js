const mongoose = require("mongoose");
const { ROLES } = require("#config/constants");

const ScienceProgram = require("./scienceProgram.model");
const WorkingPlan = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const Controller = require("./scienceProgram.controller");

const SCIENCE_ID = new mongoose.Types.ObjectId();
const AY_2023 = new mongoose.Types.ObjectId();
const AY_2026 = new mongoose.Types.ObjectId();

const particle = (total) => [
  { slug: "soat", canonical: "hour", value: total * 2 },
  { slug: "jami", canonical: "total", value: total },
  { slug: "maruza", canonical: "lecture", value: 12 },
  { slug: "mustaqil_ta_lim", canonical: "independent", value: total },
];

const planFixture = ({ academicYear, code, serialNumber, credits, total }) => ({
  workingSchedule: { academicYear, direction: new mongoose.Types.ObjectId() },
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
                serialNumber,
                code,
                totalCredit: credits,
                weeklyHours: 4,
                particle: particle(total),
              },
            ],
          },
        ],
      },
    ],
  ]),
});

const PLAN_2023 = planFixture({
  academicYear: AY_2023,
  code: "AN11-312",
  serialNumber: "1.05",
  credits: 8,
  total: 60,
});
const PLAN_2026 = planFixture({
  academicYear: AY_2026,
  code: "AN11-312",
  serialNumber: "1.2.06",
  credits: 4,
  total: 30,
});

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makeReq = (body = {}) => ({
  body: { science: String(SCIENCE_ID), ...body },
  user: { _id: new mongoose.Types.ObjectId(), role: { title: ROLES.SUPER_ADMIN } },
});

const wireLookup = (plans) => {
  jest.spyOn(WorkingScheduleModel, "find").mockReturnValue({
    distinct: jest.fn().mockResolvedValue([new mongoose.Types.ObjectId()]),
  });
  const chain = {};
  chain.sort = jest.fn(() => chain);
  chain.populate = jest.fn(() => chain);
  chain.exec = jest.fn().mockResolvedValue(plans);
  jest.spyOn(WorkingPlan, "find").mockReturnValue(chain);
};

const runCreate = async (plans, body = {}) => {
  wireLookup(plans);
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
  return { captured, res, next };
};

beforeEach(() => {
  jest.restoreAllMocks();
});

describe("T-09 — meta so'ralgan o'quv yilining rejasidan olinadi", () => {
  test("eng yangi paket 2026/2027, lekin so'rov 2023/2024 → 2023/2024 rejasi ishlatiladi", async () => {
    const { captured, next } = await runCreate([PLAN_2026, PLAN_2023], {
      academicYear: String(AY_2023),
    });

    expect(next).not.toHaveBeenCalled();
    expect(String(captured.academicYear)).toBe(String(AY_2023));
    expect(captured.serialNumber).toBe("1.05");
    expect(captured.credits).toBe(8);
    expect(captured.classroomHours).toBe(60);
  });

  test("201 javobida ogohlantirish YO'Q (meta to'ldi)", async () => {
    const { res } = await runCreate([PLAN_2026, PLAN_2023], {
      academicYear: String(AY_2023),
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.not.objectContaining({ warning: expect.anything() }),
    );
  });

  test("so'ralgan yil uchun reja YO'Q → meta BO'SH + ogohlantirish (boshqa yil soatlari ko'chirilmaydi)", async () => {
    const otherYear = new mongoose.Types.ObjectId();
    const { captured, res, next } = await runCreate([PLAN_2026, PLAN_2023], {
      academicYear: String(otherYear),
    });

    expect(next).not.toHaveBeenCalled();
    expect(String(captured.academicYear)).toBe(String(otherYear));
    expect(captured.serialNumber).toBeFalsy();
    expect(captured.credits).toBeFalsy();
    expect(captured.classroomHours).toBeFalsy();

    const payload = res.json.mock.calls[0][0];
    expect(payload.warning).toMatch(/ishchi o'quv reja topilmadi/);
    expect(payload.warning).toMatch(/Tanlangan o'quv yili/);
  });

  test("yil BERILMASA — eski xulq: eng yangi mos reja (regressiya qulfi)", async () => {
    const { captured } = await runCreate([PLAN_2026, PLAN_2023]);
    expect(captured.serialNumber).toBe("1.2.06");
    expect(String(captured.academicYear)).toBe(String(AY_2026));
  });

  test("bitta paketli baza (lokal `institute-demo`) — yil berilsa ham o'sha reja (xulq o'zgarmaydi)", async () => {
    const { captured } = await runCreate([PLAN_2023], {
      academicYear: String(AY_2023),
    });
    expect(captured.serialNumber).toBe("1.05");
    expect(String(captured.academicYear)).toBe(String(AY_2023));
  });
});

describe("T-09 — GET /working-plan-status yil bilan mos javob beradi", () => {
  const makeStatusReq = (query) => ({ query });

  test("yil berilsa — o'sha yil rejasi bo'yicha (planHours 2023/2024 paketidan)", async () => {
    wireLookup([PLAN_2026, PLAN_2023]);
    const res = makeRes();
    await Controller.getWorkingPlanStatus(
      makeStatusReq({ science: String(SCIENCE_ID), academicYear: String(AY_2023) }),
      res,
      jest.fn(),
    );
    const payload = res.json.mock.calls[0][0];
    expect(payload.hasWorkingPlan).toBe(true);
    expect(payload.warning).toBeNull();
    expect(payload.planHours.classroomHours).toBe(60);
  });

  test("yil uchun reja yo'q → hasWorkingPlan:false + yil ogohlantirishi (201 yo'li bilan bir xil)", async () => {
    wireLookup([PLAN_2026, PLAN_2023]);
    const res = makeRes();
    await Controller.getWorkingPlanStatus(
      makeStatusReq({
        science: String(SCIENCE_ID),
        academicYear: String(new mongoose.Types.ObjectId()),
      }),
      res,
      jest.fn(),
    );
    const payload = res.json.mock.calls[0][0];
    expect(Object.keys(payload)).toEqual([
      "hasWorkingPlan",
      "warning",
      "planHours",
    ]);
    expect(payload.hasWorkingPlan).toBe(false);
    expect(payload.planHours).toBeNull();
    expect(payload.warning).toMatch(/ishchi o'quv reja topilmadi/);
  });

  test("yilsiz chaqiruv — eski xulq (FE hozir shunday chaqiradi)", async () => {
    wireLookup([PLAN_2026, PLAN_2023]);
    const res = makeRes();
    await Controller.getWorkingPlanStatus(
      makeStatusReq({ science: String(SCIENCE_ID) }),
      res,
      jest.fn(),
    );
    const payload = res.json.mock.calls[0][0];
    expect(payload.hasWorkingPlan).toBe(true);
    expect(payload.planHours.classroomHours).toBe(30);
  });
});
