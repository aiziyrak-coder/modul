"use strict";

jest.mock("#shared/winston.logger", () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));

const winston = require("#shared/winston.logger");
const { ErrorHandler } = require("#shared/error");
const Attendance = require("./attendance.model");
const {
  DUPLICATE_LESSON_MESSAGE,
  DUPLICATE_LESSON_REASON,
  isDuplicateLessonError,
  duplicateLessonError,
  attendanceWriteError,
} = require("./duplicateLesson");

describe("duplicateLesson — xato shartnomasi", () => {
  test("isDuplicateLessonError: faqat code 11000", () => {
    expect(isDuplicateLessonError({ code: 11000 })).toBe(true);
    expect(isDuplicateLessonError({ code: 11001 })).toBe(false);
    expect(isDuplicateLessonError(new Error("E11000 matn, kodsiz"))).toBe(false);
    expect(isDuplicateLessonError(undefined)).toBe(false);
    expect(isDuplicateLessonError(null)).toBe(false);
  });

  test("duplicateLessonError: 400, eski matn, reason meta'da, detail bo'sh", () => {
    const e = duplicateLessonError();
    expect(e).toBeInstanceOf(ErrorHandler);
    expect(e).toMatchObject({ statusCode: 400, message: DUPLICATE_LESSON_MESSAGE, detail: "" });
    expect(e.meta).toEqual({ reason: DUPLICATE_LESSON_REASON });
    expect(DUPLICATE_LESSON_MESSAGE).toBe("Bu dars uchun davomat allaqachon kiritilgan");
    expect(DUPLICATE_LESSON_REASON).toBe("duplicate_lesson");
    expect(duplicateLessonError()).not.toBe(e);
  });

  test("attendanceWriteError: E11000 → duplicate_lesson (fallback matn ishlatilmaydi)", () => {
    const e = attendanceWriteError({ code: 11000, message: "E11000 duplicate key" }, "Davomat qo'shishda xato");
    expect(e).toBeInstanceOf(ErrorHandler);
    expect(e).toMatchObject({ statusCode: 400, message: DUPLICATE_LESSON_MESSAGE, detail: "" });
    expect(e.meta).toEqual({ reason: "duplicate_lesson" });
  });

  test("attendanceWriteError: boshqa xato — fallback matn + detail, reason YO'Q", () => {
    const e = attendanceWriteError(new Error("Cast to ObjectId failed"), "Davomatni yangilashda xato");
    expect(e).toBeInstanceOf(ErrorHandler);
    expect(e).toMatchObject({
      statusCode: 400,
      message: "Davomatni yangilashda xato",
      detail: "Cast to ObjectId failed",
    });
    expect(e.meta).toBeUndefined();
  });

  test("attendanceWriteError: null/undefined xato ham yiqilmaydi", () => {
    expect(attendanceWriteError(undefined, "X")).toMatchObject({ statusCode: 400, message: "X" });
    expect(attendanceWriteError(null, "Y").detail).toBeUndefined();
  });
});

describe("attendance.model — resident_lesson_unique", () => {
  const declared = () =>
    Attendance.schema.indexes().find(([, opts]) => opts.name === Attendance.LESSON_UNIQUE_INDEX_NAME);

  test("sxemada: kalit TARTIBI, unique, partial {deletedAt:null}", () => {
    expect(Attendance.LESSON_UNIQUE_INDEX_NAME).toBe("resident_lesson_unique");
    const [key, opts] = declared();
    expect(Object.keys(key)).toEqual(["resident", "date", "science", "lessonType"]);
    expect(Object.values(key)).toEqual([1, 1, 1, 1]);
    expect(opts).toMatchObject({ unique: true, name: "resident_lesson_unique" });
    expect(opts.partialFilterExpression).toEqual({ deletedAt: null });
  });

  test("lessonUniqueIndex() — sxemadagi bilan bir xil, har chaqiruvda YANGI obyekt", () => {
    const a = Attendance.lessonUniqueIndex();
    const b = Attendance.lessonUniqueIndex();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a.key).not.toBe(b.key);
    expect(a.options.partialFilterExpression).not.toBe(b.options.partialFilterExpression);
    const [key, opts] = declared();
    expect(key).toEqual(a.key);
    expect(opts).toMatchObject(a.options);
  });

  test("mavjud `resident_1` indeksi tegilmagan", () => {
    expect(Attendance.schema.indexes().map(([k]) => k)).toContainEqual({ resident: 1 });
  });
});

describe("attendance.model — indeks qurilmasa LOG (P9-Q26)", () => {
  beforeEach(() => winston.error.mockClear());

  test("`index` hodisasi xato bilan → winston.error: teg, indeks nomi, asl xato", () => {
    const err = Object.assign(new Error("E11000 duplicate key error collection: t.attendances index: resident_lesson_unique"), {
      code: 11000,
    });
    Attendance.emit("index", err);
    expect(winston.error).toHaveBeenCalledTimes(1);
    expect(winston.error.mock.calls[0][0]).toMatch(/^\[4\.5 attendance\] indeks qurilmadi .*resident_lesson_unique.*: E11000/);
  });

  test("xatosiz `index` hodisasi (indekslar qurildi) — log YO'Q", () => {
    Attendance.emit("index", undefined);
    Attendance.emit("index", null);
    expect(winston.error).not.toHaveBeenCalled();
  });
});
