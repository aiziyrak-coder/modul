"use strict";

jest.mock("#references/_services/educationActivityResolver", () => ({
  populateAllSlugRefs: jest.fn().mockResolvedValue(undefined),
}));

const WorkingScheduleModel = require("./workingSchedule.model");
const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const Controller = require("./workingSchedule.controller");
const { ROLES } = require("#config/constants");
const { EMPTY_SLOT_TITLE } = require("#modules/4.02-studyLoad/_shared/planRowType");
const { countEmptySlots } = require("#modules/4.02-studyLoad/_shared/electiveSlotRow");

const DOC_ID = "cccccccccccccccccccccccc";
const USER_ID = "333333333333333333333333";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const draftDoc = () => ({
  _id: DOC_ID,
  status: "draft",
  approvalHistory: ["methodical", "dean", "prorektor", "rektor"].map((step) => ({ step, status: "pending" })),
  save: jest.fn().mockResolvedValue(undefined),
});

const slot = () => ({ code: null, science: null, title: EMPTY_SLOT_TITLE, totalCredit: 3, weeklyHours: 3 });
const subject = () => ({ code: "FS1104", science: "sci-1", title: "Falsafa", totalCredit: 4 });
const tf = (sciences) => ({ blockCode: "TF2", title: "Tanlov fanlar", sciences });
const mf = (sciences) => ({ blockCode: "MF1", title: "Majburiy fanlar", sciences });

const mockPlans = (plans) =>
  jest.spyOn(WorkingPlanModel, "find").mockReturnValue({
    select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(plans) }),
  });

const submit = async () => {
  const res = createRes();
  const next = jest.fn();
  await Controller.approve(
    {
      params: { id: DOC_ID },
      body: {},
      scope: {},
      user: { _id: USER_ID, role: { title: ROLES.OQUV_USLUBIY_BOSHQARMA } },
    },
    res,
    next,
  );
  expect(next).not.toHaveBeenCalled();
  return res.json.mock.calls[0][0];
};

afterEach(() => jest.restoreAllMocks());

describe("countEmptySlots — sof sanoq", () => {
  test("Map va obyekt, faqat TANLOV blokidagi bo'sh slotlar sanaladi", () => {
    const sems = new Map([
      ["1", { blocks: [tf([slot(), subject()])] }],
      ["2", { blocks: [tf([slot()]), mf([subject()])] }],
    ]);
    expect(countEmptySlots(sems)).toBe(2);
    expect(countEmptySlots({ 1: { blocks: [tf([subject()])] } })).toBe(0);
    expect(countEmptySlots({ 1: { blocks: [mf([slot()])] } })).toBe(0);
    expect(countEmptySlots(null)).toBe(0);
  });
});

describe("approve (draft → in_review) — to'ldirilmagan slotlar: OGOHLANTIRISH (Q1 = b)", () => {
  test("2 ta slot → yuboriladi (in_review), `unfilledSlots: 2` + warning", async () => {
    const doc = draftDoc();
    jest.spyOn(WorkingScheduleModel, "findOne").mockResolvedValue(doc);
    mockPlans([{ semesters: { 1: { blocks: [tf([slot(), subject()])] }, 2: { blocks: [tf([slot()])] } } }]);
    const out = await submit();
    expect(doc.status).toBe("in_review");
    expect(doc.save).toHaveBeenCalledTimes(1);
    expect(out).toMatchObject({ action: "submitted", status: "in_review", unfilledSlots: 2 });
    expect(out.warning).toMatch(/2 ta tanlov fani sloti/);
  });

  test("slot yo'q → `unfilledSlots: 0`, `warning: null` (xulq o'zgarmadi)", async () => {
    const doc = draftDoc();
    jest.spyOn(WorkingScheduleModel, "findOne").mockResolvedValue(doc);
    mockPlans([{ semesters: { 1: { blocks: [tf([subject()])] } } }]);
    const out = await submit();
    expect(out).toMatchObject({ action: "submitted", unfilledSlots: 0, warning: null });
  });

  test("ishchi reja hali yo'q (bo'sh ro'yxat) — 0, xato emas", async () => {
    const doc = draftDoc();
    jest.spyOn(WorkingScheduleModel, "findOne").mockResolvedValue(doc);
    mockPlans([]);
    const out = await submit();
    expect(out.unfilledSlots).toBe(0);
  });
});
