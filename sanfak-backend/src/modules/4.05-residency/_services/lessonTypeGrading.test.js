"use strict";

const { ErrorHandler } = require("#shared/error");
const {
  lessonTypeScoreError,
  lessonTypeWriteGuard,
  isGradedLessonType,
  LESSON_TYPE_NOT_GRADED,
  LESSON_TYPE_NOT_GRADED_MSG,
  UNGRADED_LESSON_TYPES,
} = require("./lessonTypeGrading");

const SESSION_TEXT =
  "Amaliy mashg'ulotga har dars uchun ball qo'yilmaydi — oraliq nazorat orqali baholanadi";

const AMALIY_SCORED = { lessonType: "amaliy", score: 7 };
const MARUZA_SCORED = { lessonType: "maruza", score: 8 };

describe("lessonTypeScoreError — rad etiladi (409)", () => {
  test.each([
    ["POST amaliy + 8", { lessonType: "amaliy", score: 8 }, undefined],
    ["POST amaliy + 0 (0 ham ball)", { lessonType: "amaliy", score: 0 }, undefined],
    ["PUT {score:8}, saqlangan amaliy", { score: 8 }, { lessonType: "amaliy", score: null }],
    ["PUT {lessonType:amaliy}, saqlangan maruza + 8", { lessonType: "amaliy" }, MARUZA_SCORED],
  ])("%s", (_label, write, current) => {
    const err = lessonTypeScoreError(write, current);
    expect(err).toBeInstanceOf(ErrorHandler);
    expect(err).toMatchObject({
      statusCode: 409,
      message: SESSION_TEXT,
      detail: LESSON_TYPE_NOT_GRADED,
      meta: { reason: "lesson_type_not_graded" },
    });
  });
});

describe("lessonTypeScoreError — o'tadi (null)", () => {
  test.each([
    ["POST amaliy + score:null", { lessonType: "amaliy", score: null }, undefined],
    ["POST amaliy, ballsiz", { lessonType: "amaliy" }, undefined],
    ["POST maruza + 8", { lessonType: "maruza", score: 8 }, undefined],
    ["POST dars turisiz + 8", { score: 8 }, undefined],
    ["POST lessonType '' + 8", { lessonType: "", score: 8 }, undefined],
    ["PUT {score:null}, saqlangan amaliy + 7 (tozalash)", { score: null }, AMALIY_SCORED],
    ["PUT {lessonType:amaliy, score:null}, saqlangan maruza + 8", { lessonType: "amaliy", score: null }, MARUZA_SCORED],
    ["PUT {hours:3}, saqlangan amaliy + 7 (L3-Q14)", { hours: 3 }, AMALIY_SCORED],
    ["PUT {status:absent}, saqlangan amaliy + 7 (L3-Q14)", { status: "absent" }, AMALIY_SCORED],
    ["PUT {lessonType:maruza, score:6}, saqlangan amaliy", { lessonType: "maruza", score: 6 }, AMALIY_SCORED],
  ])("%s", (_label, write, current) => {
    expect(lessonTypeScoreError(write, current)).toBeNull();
  });
});

describe("yagona manba", () => {
  test("matn va kod sessiya endpointi bilan bir xil", () => {
    expect(LESSON_TYPE_NOT_GRADED_MSG).toBe(SESSION_TEXT);
    expect(LESSON_TYPE_NOT_GRADED).toBe("lesson_type_not_graded");
  });

  test("faqat amaliy baholanmaydi", () => {
    expect(UNGRADED_LESSON_TYPES).toEqual(["amaliy"]);
    expect(Object.isFrozen(UNGRADED_LESSON_TYPES)).toBe(true);
    expect(isGradedLessonType("amaliy")).toBe(false);
    for (const t of ["maruza", "test", "oraliq_nazorat", "yakuniy_nazorat", null, undefined, ""]) {
      expect(isGradedLessonType(t)).toBe(true);
    }
  });
});

describe("lessonTypeWriteGuard — PUT CAS sharti (parallel PUT, L3-Q13)", () => {
  const PINNED_TYPE = { lessonType: { $nin: ["amaliy"] } };
  test.each([
    ["{score:8} — dars turi saqlangan qatordan", { score: 8 }, PINNED_TYPE],
    ["{score:0} — 0 ham ball", { score: 0 }, PINNED_TYPE],
    ["{lessonType:amaliy} — ball saqlangan qatordan", { lessonType: "amaliy" }, { score: null }],
    ["{score:null} — tozalash", { score: null }, {}],
    ["{lessonType:amaliy, score:null} — yakuniy holat so'rovda", { lessonType: "amaliy", score: null }, {}],
    ["{lessonType:maruza, score:8} — yakuniy holat so'rovda", { lessonType: "maruza", score: 8 }, {}],
    ["{lessonType:maruza} — baholanadigan tur", { lessonType: "maruza" }, {}],
    ["{hours:3} — tegmagan (L3-Q14)", { hours: 3 }, {}],
  ])("%s", (_label, write, guard) => {
    expect(lessonTypeWriteGuard(write)).toEqual(guard);
  });

  test("shart ro'yxati muzlatilgan manbani o'zgartirmaydi (nusxa)", () => {
    const guard = lessonTypeWriteGuard({ score: 8 });
    expect(guard.lessonType.$nin).not.toBe(UNGRADED_LESSON_TYPES);
  });
});
