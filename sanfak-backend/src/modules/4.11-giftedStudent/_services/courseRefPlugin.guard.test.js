"use strict";

const mongoose = require("mongoose");

jest.mock("#shared/winston.logger", () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
}));

const mockKURS = {
  1: new mongoose.Types.ObjectId("69df7a8f94bda50c83a1d3f5"),
  2: new mongoose.Types.ObjectId("69df7a8f94bda50c83a1d3f7"),
  3: new mongoose.Types.ObjectId("69df7a8f94bda50c83a1d3f9"),
};

jest.mock("#references/course/course.model", () => ({
  find: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([
      { _id: mockKURS[1], title: "1-kurs" },
      { _id: mockKURS[2], title: "2-kurs" },
      { _id: mockKURS[3], title: "3-kurs" },
    ]),
  })),
}));

const courseRefPlugin = require("./courseRefPlugin");
const { allowedCoursesRefPlugin, clearCache } = require("./courseRefPlugin");

const hookFor = (plugin, fields, op = "findOneAndUpdate") => {
  const schema = new mongoose.Schema(fields);
  schema.plugin(plugin);
  const pres = schema.s.hooks._pres.get(op);
  return pres[pres.length - 1].fn;
};

const drive = (hook, update) =>
  new Promise((resolve) => {
    const ctx = { getUpdate: () => update, setUpdate: () => {} };
    hook.call(ctx, (err) => resolve(err ?? null));
  });

const STUDENT_FIELDS = {
  course: Number,
  courseId: mongoose.Schema.Types.ObjectId,
};
const SCHOLARSHIP_FIELDS = {
  allowedCourses: [String],
  allowedCourseIds: [mongoose.Schema.Types.ObjectId],
};

beforeEach(() => clearCache());

describe("giftedStudent.course — ko'r operatorlar RAD ETILADI", () => {
  const hook = () => hookFor(courseRefPlugin, STUDENT_FIELDS);

  test.each([
    ["$inc", { $inc: { course: 1 } }],
    ["$mul", { $mul: { course: 2 } }],
    ["$min", { $min: { course: 1 } }],
    ["$max", { $max: { course: 6 } }],
    ["$unset", { $unset: { course: "" } }],
    ["$rename", { $rename: { course: "kurs" } }],
  ])("%s xato beradi", async (_op, update) => {
    const err = await drive(hook(), update);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain("courseId");
    expect(err.message).toContain("$set");
  });

  test("🔴 yillik ko'tarishning aynan o'zi — `$inc` — to'siladi", async () => {
    const err = await drive(hook(), { $inc: { course: 1 } });
    expect(err.message).toContain("$inc");
  });
});

describe("giftedStudent.course — ko'rinadigan shakllar ISHLAYDI", () => {
  const hook = () => hookFor(courseRefPlugin, STUDENT_FIELDS);

  test("$set juftlikni tekislaydi", async () => {
    const update = { $set: { course: 2 } };
    expect(await drive(hook(), update)).toBeNull();
    expect(update.$set.course).toBe(2);
    expect(String(update.$set.courseId)).toBe(String(mockKURS[2]));
  });

  test("yalang'och obyekt shakli ham", async () => {
    const update = { course: 3 };
    expect(await drive(hook(), update)).toBeNull();
    expect(String(update.courseId)).toBe(String(mockKURS[3]));
  });

  test("$setOnInsert ham qamraladi (upsert yo'li)", async () => {
    const update = { $setOnInsert: { course: 1 } };
    expect(await drive(hook(), update)).toBeNull();
    expect(String(update.$setOnInsert.courseId)).toBe(String(mockKURS[1]));
  });

  test("ma'lumotnomada yo'q RAQAM — ref TOZALANADI, eskisi qolmaydi", async () => {
    const update = { $set: { course: 6 } };
    expect(await drive(hook(), update)).toBeNull();
    expect(update.$set.course).toBe(6);
    expect(update.$set.courseId).toBeNull();
  });

  test("🔴 noma'lum 24-hex endi JIM O'TMAYDI", async () => {
    const err = await drive(hook(), {
      $set: { course: "bbbbbbbbbbbbbbbbbbbbbb99" },
    });
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain("topilmadi");
  });

  test("course ga tegmaydigan yangilash TEGILMAYDI", async () => {
    const update = { $set: { fullName: "Aliyev Sardor" } };
    expect(await drive(hook(), update)).toBeNull();
    expect(update.$set).not.toHaveProperty("courseId");
  });
});

describe("scholarship.allowedCourses — massiv operatorlari RAD ETILADI", () => {
  const hook = () => hookFor(allowedCoursesRefPlugin, SCHOLARSHIP_FIELDS);

  test.each([
    ["$push", { $push: { allowedCourses: "3" } }],
    ["$addToSet", { $addToSet: { allowedCourses: "3" } }],
    ["$pull", { $pull: { allowedCourses: "2" } }],
    ["$pullAll", { $pullAll: { allowedCourses: ["2"] } }],
    ["$pop", { $pop: { allowedCourses: 1 } }],
    ["$unset", { $unset: { allowedCourses: "" } }],
  ])("%s xato beradi", async (_op, update) => {
    const err = await drive(hook(), update);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain("allowedCourseIds");
  });

  test("🔴 `$pull` eng xavflisi — ref da QOLIB ketardi", async () => {
    const err = await drive(hook(), { $pull: { allowedCourses: "2" } });
    expect(err.message).toContain("$pull");
  });
});

describe("scholarship.allowedCourses — ko'rinadigan shakllar ISHLAYDI", () => {
  const hook = () => hookFor(allowedCoursesRefPlugin, SCHOLARSHIP_FIELDS);

  test("$set ikkala ro'yxatni birga yozadi", async () => {
    const update = { $set: { allowedCourses: ["1", "2"] } };
    expect(await drive(hook(), update)).toBeNull();
    expect(update.$set.allowedCourses).toEqual(["1", "2"]);
    expect(update.$set.allowedCourseIds.map(String)).toEqual([
      String(mockKURS[1]),
      String(mockKURS[2]),
    ]);
  });

  test("ref hex yuborilsa SATRGA aylantiriladi", async () => {
    const update = { $set: { allowedCourses: [String(mockKURS[3])] } };
    expect(await drive(hook(), update)).toBeNull();
    expect(update.$set.allowedCourses).toEqual(["3"]);
    expect(update.$set.allowedCourseIds.map(String)).toEqual([String(mockKURS[3])]);
  });

  test("ma'lumotnomada yo'q qiymat SATRDA qoladi, ref ga kirmaydi", async () => {
    const update = { $set: { allowedCourses: ["6", "mag-1"] } };
    expect(await drive(hook(), update)).toBeNull();
    expect(update.$set.allowedCourses).toEqual(["6", "mag-1"]);
    expect(update.$set.allowedCourseIds).toEqual([]);
  });
});
