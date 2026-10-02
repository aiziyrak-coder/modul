"use strict";

jest.mock("#modules/4.02-studyLoad/workingPlan/workingPlan.model", () => ({
  find: jest.fn(),
}));
jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model", () => ({
  find: jest.fn(),
}));

const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const {
  courseOfSemester,
  relevantDerivedSchedules,
  propagateElectiveRow,
  retractElectiveRow,
  electiveWarning,
} = require("./studyPlan.electivePropagation");

const BLOCK = { blockCode: "TF2", serialNumber: "2.00", code: null, title: "Tanlov fanlar" };
const ROW = {
  serialNumber: null,
  code: "AG18-906",
  title: "Akusherlik va ginekologiya 1,2",
  science: "sci-ag",
  department: "dep-1",
  particle: [],
  semesters: { 5: { hour: 5, credit: 5, particles: [], assessmentType: null } },
  totalCredit: 5,
  alternatives: [{ science: "sci-alt", code: "ALT1", title: "Alt", department: null }],
};

function makePlan({ id, scheduleId, semesters }) {
  const map = new Map();
  for (const [k, v] of Object.entries(semesters)) map.set(k, v);
  return {
    _id: id,
    workingSchedule: scheduleId,
    semesters: map,
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
}

function mockDerived(plans, schedules) {
  WorkingPlanModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue(plans) });
  WorkingScheduleModel.find.mockReturnValue({
    select: () => ({ lean: jest.fn().mockResolvedValue(schedules) }),
  });
}

beforeEach(() => jest.clearAllMocks());

describe("courseOfSemester", () => {
  test.each([
    ["1", 1, "1"],
    ["2", 1, "2"],
    ["5", 3, "1"],
    ["6", 3, "2"],
    ["12", 6, "2"],
  ])("global %s → kurs %i, kurs ichida %s", (g, course, local) => {
    expect(courseOfSemester(g)).toEqual({ courseNum: course, localSemKey: local });
  });
  test("noto'g'ri kalit → null", () => {
    expect(courseOfSemester("x")).toBeNull();
    expect(courseOfSemester(0)).toBeNull();
  });
});

describe("propagateElectiveRow", () => {
  test("draft III kurs rejasiga 5-semestr qatori 1-semestrga (kurs ichida) qo'shiladi, yig'indi save orqali", async () => {
    const plan = makePlan({
      id: "wp3",
      scheduleId: "ws3",
      semesters: { 1: { semester: "1", blocks: [{ blockCode: "MF1", title: "Majburiy fanlar", sciences: [] }] } },
    });
    mockDerived([plan], [{ _id: "ws3", status: "draft", currentCourse: 3 }]);

    const r = await propagateElectiveRow({ studyPlanId: "sp1", block: BLOCK, row: ROW });

    expect(r).toEqual({ propagated: 1, skippedLocked: 0 });
    const sem1 = plan.semesters.get("1");
    const tf2 = sem1.blocks.find((b) => b.blockCode === "TF2");
    expect(tf2).toBeTruthy();
    expect(tf2.title).toBe("Tanlov fanlar");
    expect(tf2.sciences).toHaveLength(1);
    expect(tf2.sciences[0]).toMatchObject({
      code: "AG18-906",
      science: "sci-ag",
      totalCredit: 5,
      weeklyHours: 5,
      particle: [],
      alternatives: [{ science: "sci-alt", code: "ALT1" }],
    });
    expect(plan.markModified).toHaveBeenCalledWith("semesters");
    expect(plan.save).toHaveBeenCalledTimes(1);
  });

  test("qulflangan (approved/in_review) reja TEGILMAYDI — skippedLocked", async () => {
    const approved = makePlan({ id: "wpA", scheduleId: "wsA", semesters: { 1: { semester: "1", blocks: [] } } });
    const review = makePlan({ id: "wpR", scheduleId: "wsR", semesters: { 1: { semester: "1", blocks: [] } } });
    mockDerived(
      [approved, review],
      [
        { _id: "wsA", status: "approved", currentCourse: 3 },
        { _id: "wsR", status: "in_review", currentCourse: 3 },
      ],
    );

    const r = await propagateElectiveRow({ studyPlanId: "sp1", block: BLOCK, row: ROW });

    expect(r).toEqual({ propagated: 0, skippedLocked: 2 });
    expect(approved.save).not.toHaveBeenCalled();
    expect(review.save).not.toHaveBeenCalled();
  });

  test("boshqa kurs rejasi (I kurs) 5-semestr qatorini olmaydi — save yo'q", async () => {
    const plan = makePlan({ id: "wp1", scheduleId: "ws1", semesters: { 1: { semester: "1", blocks: [] } } });
    mockDerived([plan], [{ _id: "ws1", status: "draft", currentCourse: 1 }]);

    const r = await propagateElectiveRow({ studyPlanId: "sp1", block: BLOCK, row: ROW });

    expect(r).toEqual({ propagated: 0, skippedLocked: 0 });
    expect(plan.save).not.toHaveBeenCalled();
  });

  test("qator allaqachon bo'lsa — idempotent (ikkinchi nusxa qo'shilmaydi)", async () => {
    const plan = makePlan({
      id: "wp3",
      scheduleId: "ws3",
      semesters: {
        1: { semester: "1", blocks: [{ blockCode: "TF2", sciences: [{ code: "AG18-906", science: "sci-ag" }] }] },
      },
    });
    mockDerived([plan], [{ _id: "ws3", status: "draft", currentCourse: 3 }]);

    const r = await propagateElectiveRow({ studyPlanId: "sp1", block: BLOCK, row: ROW });

    expect(r).toEqual({ propagated: 0, skippedLocked: 0 });
    expect(plan.semesters.get("1").blocks[0].sciences).toHaveLength(1);
    expect(plan.save).not.toHaveBeenCalled();
  });
});

describe("retractElectiveRow", () => {
  test("fan refi bo'yicha faqat tanlov blokidan olib tashlanadi; qulflangan tegilmaydi", async () => {
    const draft = makePlan({
      id: "wp3",
      scheduleId: "ws3",
      semesters: {
        1: {
          semester: "1",
          blocks: [
            { blockCode: "MF1", sciences: [{ code: "X", science: "sci-ag" }] },
            { blockCode: "TF2", sciences: [{ code: "AG18-906", science: "sci-ag" }, { code: "OTHER", science: "sci-o" }] },
          ],
        },
      },
    });
    const approved = makePlan({
      id: "wpA",
      scheduleId: "wsA",
      semesters: { 1: { semester: "1", blocks: [{ blockCode: "TF2", sciences: [{ code: "AG18-906", science: "sci-ag" }] }] } },
    });
    mockDerived(
      [draft, approved],
      [
        { _id: "ws3", status: "draft", currentCourse: 3 },
        { _id: "wsA", status: "approved", currentCourse: 3 },
      ],
    );

    const r = await retractElectiveRow({ studyPlanId: "sp1", blockCode: "TF2", row: ROW });

    expect(r).toEqual({ retracted: 1, skippedLocked: 1 });
    const blocks = draft.semesters.get("1").blocks;
    expect(blocks[0].sciences).toHaveLength(1);
    expect(blocks[1].sciences.map((s) => s.code)).toEqual(["OTHER"]);
    expect(draft.save).toHaveBeenCalledTimes(1);
    expect(approved.save).not.toHaveBeenCalled();
  });
});

describe("relevantDerivedSchedules", () => {
  test("faqat qator semestrlari kursidagi jadvallar (har status), qamrov maydonlari bilan", async () => {
    const p1 = makePlan({ id: "wp1", scheduleId: "ws1", semesters: {} });
    const p3 = makePlan({ id: "wp3", scheduleId: "ws3", semesters: {} });
    const pA = makePlan({ id: "wpA", scheduleId: "wsA", semesters: {} });
    mockDerived(
      [p1, p3, pA],
      [
        { _id: "ws1", status: "draft", currentCourse: 1, academicYear: "ay1", year: "2025/2026", direction: "d" },
        { _id: "ws3", status: "draft", currentCourse: 3, academicYear: "ay3", year: "2027/2028", direction: "d" },
        { _id: "wsA", status: "approved", currentCourse: 3, academicYear: "ay3", year: "2027/2028", direction: "d" },
      ],
    );

    const list = await relevantDerivedSchedules({ studyPlanId: "sp1", row: ROW });

    expect(list.map((s) => s._id).sort()).toEqual(["ws3", "wsA"]);
    expect(list[0]).toMatchObject({ academicYear: "ay3", year: "2027/2028", direction: "d" });
  });
});

describe("electiveWarning", () => {
  test("ishchi reja yo'q → null", () => {
    expect(electiveWarning(0, { propagated: 0, skippedLocked: 0 })).toBeNull();
  });
  test("qo'shilgan + qulflangan sonlari matnda", () => {
    expect(electiveWarning(3, { propagated: 1, skippedLocked: 2 })).toBe(
      "1 ta ishchi rejaga qo'shildi; 2 ta qulflangan (tasdiqlanayotgan/tasdiqlangan) ishchi rejaga kirmadi",
    );
  });
  test("olib tashlash iborasi", () => {
    expect(
      electiveWarning(1, { retracted: 1, skippedLocked: 0 }, "ta ishchi rejadan olib tashlandi"),
    ).toBe("1 ta ishchi rejadan olib tashlandi");
  });
  test("mos kurs rejasi yo'q → tushuntirish", () => {
    expect(electiveWarning(2, { propagated: 0, skippedLocked: 0 })).toBe(
      "Shu semestr kursi uchun ishchi reja yo'q — generatsiya qilinganda kiradi",
    );
  });
  test("olib tashlashda qator hech qayerda bo'lmasa → neytral matn", () => {
    expect(electiveWarning(2, { retracted: 0, skippedLocked: 0 }, "ta ishchi rejadan olib tashlandi")).toBe(
      "Ishchi rejalarda bu qator yo'q edi — hech narsa o'zgarmadi",
    );
  });
});
