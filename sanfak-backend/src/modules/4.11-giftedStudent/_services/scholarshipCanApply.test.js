"use strict";

jest.mock("#modules/4.11-giftedStudent/giftedStudent/giftedStudent.model", () => ({
  findOne: jest.fn(),
}));

const GiftedStudent = require("#modules/4.11-giftedStudent/giftedStudent/giftedStudent.model");
const {
  resolveApplicant,
  withCanApply,
  attachCanApply,
  NOT_IN_REGISTRY,
} = require("./scholarshipCanApply");
const { currentAcademicYear } = require("./academicYearWindow");
const { MODULES, ACTIONS } = require("#config/constants");

const YIL = currentAcademicYear();
const NOW = new Date(2026, 8, 9);

const talabaRole = {
  title: "talaba",
  permissions: [
    { section: MODULES.STUDENT_ACHIEVEMENT, actionKeys: [ACTIONS.CREATE] },
    { section: MODULES.SCHOLARSHIP, actionKeys: [ACTIONS.READ_ALL] },
  ],
};
const bolimRole = {
  title: "iqtidorli_bolim",
  permissions: [
    { section: MODULES.STUDENT_ACHIEVEMENT, actionKeys: [ACTIONS.CREATE] },
    { section: MODULES.GIFTED_STUDENT, actionKeys: [ACTIONS.CREATE] },
  ],
};

const gifted = (over = {}) => ({ course: 1, scoresByYear: { [YIL]: 100 }, ...over });
const sch = (over = {}) => ({
  name: "Beruniy",
  active: true,
  minScore: 0,
  allowedCourses: [],
  ...over,
});

const leanOf = (value) => ({ select: jest.fn(() => ({ lean: jest.fn(async () => value) })) });

beforeEach(() => jest.clearAllMocks());

describe("resolveApplicant — maydon FAQAT talabada", () => {
  test("🔴 talaba bo'lmasa `null` — bazaga ham murojaat qilinmaydi", async () => {
    expect(await resolveApplicant({ _id: "u1", role: bolimRole })).toBeNull();
    expect(GiftedStudent.findOne).not.toHaveBeenCalled();
  });

  test("foydalanuvchi umuman bo'lmasa ham yiqilmaydi", async () => {
    expect(await resolveApplicant(undefined)).toBeNull();
    expect(await resolveApplicant({})).toBeNull();
  });

  test("talaba — yozuv olinadi, faqat KERAKLI maydonlar bilan", async () => {
    const select = jest.fn(() => ({ lean: jest.fn(async () => gifted()) }));
    GiftedStudent.findOne.mockReturnValue({ select });
    const applicant = await resolveApplicant({ _id: "u1", role: talabaRole });
    expect(GiftedStudent.findOne).toHaveBeenCalledWith({ user: "u1" });
    expect(select).toHaveBeenCalledWith("course courseId scoresByYear");
    expect(applicant.gifted.course).toBe(1);
  });

  test("talaba, lekin reestrda yo'q — `gifted: null` (yiqilmaydi)", async () => {
    GiftedStudent.findOne.mockReturnValue(leanOf(null));
    expect(await resolveApplicant({ _id: "u1", role: talabaRole })).toEqual({ gifted: null });
  });
});

describe("withCanApply — javob shakli", () => {
  test("🔴 talaba bo'lmasa javob AYNAN o'zgarmaydi", async () => {
    const doc = sch();
    const out = withCanApply(doc, null, NOW);
    expect(out).toEqual(doc);
    expect(out).not.toHaveProperty("canApply");
    expect(out).not.toHaveProperty("canApplyReason");
  });

  test("reestrda yo'q talaba — sabab `applyForScholarship` bilan BIR XIL", async () => {
    const out = withCanApply(sch(), { gifted: null }, NOW);
    expect(out.canApply).toBe(false);
    expect(out.canApplyReason).toBe(NOT_IN_REGISTRY);
  });

  test("hamma shart bajarilsa — `true`, sabab `null`", () => {
    const out = withCanApply(sch(), { gifted: gifted() }, NOW);
    expect(out.canApply).toBe(true);
    expect(out.canApplyReason).toBeNull();
  });

  test("mongoose hujjati ham, lean obyekt ham qabul qilinadi", () => {
    const doc = { toObject: () => sch({ name: "Xorazmiy" }) };
    expect(withCanApply(doc, { gifted: gifted() }, NOW).name).toBe("Xorazmiy");
  });
});

describe("to'rtta shartning HAR BIRI qamralgan", () => {
  const reason = (schOver, giftedOver) =>
    withCanApply(sch(schOver), { gifted: gifted(giftedOver) }, NOW).canApplyReason;

  test("active", () => {
    expect(reason({ active: false })).toMatch(/faol emas/);
  });

  test("🔴 deadline — mijozda YO'Q bo'lgan aynan shu shart", () => {
    expect(reason({ deadline: new Date(2026, 8, 2) })).toMatch(/muddati tugagan/);
  });

  test("muddat KUNI hali ochiq (server `endOfDay` qoidasi)", () => {
    expect(reason({ deadline: new Date(2026, 8, 9) })).toBeNull();
  });

  test("minScore — JORIY yil bali bo'yicha", () => {
    expect(reason({ minScore: 60 }, { scoresByYear: { "2020/2021": 999 } })).toMatch(
      /Ball yetarli emas: 0\/60/,
    );
  });

  test("allowedCourses", () => {
    expect(reason({ allowedCourses: ["3"] }, { course: 1 })).toMatch(/kurslar uchun/);
  });

  test("kurs REF yo'li ham ishlaydi (satr mos kelmasa)", () => {
    const id = "6a7efdac5916905f06cebeab";
    expect(
      reason({ allowedCourses: ["1-kurs"], allowedCourseIds: [id] }, { course: 1, courseId: id }),
    ).toBeNull();
  });
});

describe("attachCanApply — ro'yxat", () => {
  test("har bir element qamraladi", () => {
    const out = attachCanApply([sch(), sch({ active: false })], { gifted: gifted() }, NOW);
    expect(out.map((s) => s.canApply)).toEqual([true, false]);
  });

  test("🔴 `now` BIR MARTA — ro'yxat boshi va oxiri bir xil vaqtni ko'radi", () => {
    const kecha = new Date(2026, 8, 8);
    const out = attachCanApply(
      [sch({ deadline: kecha }), sch({ deadline: kecha })],
      { gifted: gifted() },
      NOW,
    );
    expect(out[0].canApplyReason).toBe(out[1].canApplyReason);
  });

  test("talaba bo'lmaganda ro'yxat TEGILMAYDI", () => {
    const rows = [sch(), sch({ name: "X" })];
    expect(attachCanApply(rows, null, NOW)).toEqual(rows);
  });

  test("bo'sh ro'yxat", () => {
    expect(attachCanApply([], { gifted: gifted() }, NOW)).toEqual([]);
  });
});
