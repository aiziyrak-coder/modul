"use strict";

const express = require("express");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const request = require("supertest");

const { handleError } = require("#shared/error");
const winston = require("#shared/winston.logger");
const UserModel = require("#modules/4.01-auth/user/user.model");
const RoleModel = require("#modules/4.01-auth/role/role.model");
require("#references/department/department.model");
require("#references/science/science.model");
require("#references/group/group.model");
require("#modules/4.05-residency/residencySpecialty/residencySpecialty.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const attendanceRoutes = require("#modules/4.05-residency/attendance/attendance.routes");
const { currentAcademicYearWindow } = require("#modules/4.05-residency/_services/unexcusedWindow");
const { countUnexcusedHours } = require("#modules/4.05-residency/_services/expulsionCheck");

const app = express();
app.use(bodyParser.json());
app.use("/api/attendance", attendanceRoutes);
app.use((err, req, res, next) => handleError(err, res));

const DUP = { message: "Bu dars uchun davomat allaqachon kiritilgan", reason: "duplicate_lesson" };
const DAY = currentAcademicYearWindow().from.toISOString().slice(0, 10);

let token;
let rO;

beforeAll(async () => {
  await Attendance.init();
});

beforeEach(async () => {
  const role = await RoleModel.create({
    title: "magistratura_bolim",
    desc: "bo'lim (test)",
    permissions: [
      { section: "residentAttendance", actionKeys: ["create", "read", "readAll", "update"] },
    ],
    scopeLevel: "global",
    active: true,
  });
  const user = await UserModel.create({ firstName: "Test", lastName: "Bolim", role: role._id, active: true });
  token = jwt.sign({ _id: String(user._id) }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
  rO = await Resident.create({ program: "ordinatura", fullName: "Ordinator", courseNumber: 1 });
});

const post = (body) =>
  request(app).post("/api/attendance").set("Authorization", `Bearer ${token}`).send(body);
const put = (id, body) =>
  request(app).put(`/api/attendance/${id}`).set("Authorization", `Bearer ${token}`).send(body);
const lesson = (extra) => ({
  resident: String(rO._id),
  date: DAY,
  lessonType: "amaliy",
  status: "absent",
  hours: 2,
  ...extra,
});
const nativeCount = (filter = {}) => Attendance.collection.countDocuments(filter);
const storedHours = async () => (await Resident.findById(rO._id).lean()).totalUnexcusedHours;
const row = (extra) => ({ resident: rO._id, date: new Date(DAY), status: "absent", hours: 2, ...extra });
const insertError = (doc) => Attendance.collection.insertOne(doc).then(() => null, (e) => e);

describe("indeks spetsifikatsiyasi (bazadan)", () => {
  test("resident_lesson_unique — kalit tartibi, unique, partial {deletedAt:null}", async () => {
    const idx = (await Attendance.collection.indexes()).find((i) => i.name === "resident_lesson_unique");
    expect(idx).toBeDefined();
    expect(Object.entries(idx.key)).toEqual([["resident", 1], ["date", 1], ["science", 1], ["lessonType", 1]]);
    expect(idx.unique).toBe(true);
    expect(idx.partialFilterExpression).toEqual({ deletedAt: null });
  });
});

describe("indeks qurilmasa — log (R5, P9-Q26)", () => {
  test("🔴 dublikatli bazada indeks qurish xatosi winston.error ga chiqadi (nom + E11000)", async () => {
    await Attendance.collection.dropIndex("resident_lesson_unique");
    const spy = jest.spyOn(winston, "error").mockImplementation(() => {});
    try {
      await Attendance.collection.insertMany([row({ lessonType: "amaliy" }), row({ lessonType: "amaliy" })]);
      await expect(Attendance.createIndexes()).rejects.toMatchObject({ code: 11000 });
      expect(spy).toHaveBeenCalledWith(
        expect.stringMatching(/\[4\.5 attendance\] indeks qurilmadi.*resident_lesson_unique.*E11000/),
      );
    } finally {
      spy.mockRestore();
      await Attendance.collection.deleteMany({});
      await Attendance.createIndexes();
    }
    expect((await Attendance.collection.indexes()).map((i) => i.name)).toContain("resident_lesson_unique");
  });
});

describe("model darajasi — to'qnashuv semantikasi", () => {
  test("jonli dublikat → E11000; boshqa dars turi — ruxsat", async () => {
    await Attendance.create(row({ lessonType: "amaliy" }));
    await expect(Attendance.create(row({ lessonType: "amaliy" }))).rejects.toMatchObject({ code: 11000 });
    await expect(Attendance.create(row({ lessonType: "maruza" }))).resolves.toBeDefined();
  });

  test("science/lessonType YO'Q maydon ≡ null → E11000", async () => {
    await Attendance.collection.insertOne({ resident: rO._id, date: new Date(DAY), deletedAt: null });
    const e = await insertError({ resident: rO._id, date: new Date(DAY), science: null, lessonType: null, deletedAt: null });
    expect(e).toMatchObject({ code: 11000 });
  });

  test("deletedAt maydoni YO'Q qator ham indeksda (null ≡ yo'q)", async () => {
    await Attendance.collection.insertOne({ resident: rO._id, date: new Date(DAY), lessonType: "amaliy" });
    expect(await insertError({ resident: rO._id, date: new Date(DAY), lessonType: "amaliy" })).toMatchObject({ code: 11000 });
  });

  test("active:false qator kalitni USHLAB turadi", async () => {
    await Attendance.create(row({ lessonType: "amaliy", active: false }));
    await expect(Attendance.create(row({ lessonType: "amaliy" }))).rejects.toMatchObject({ code: 11000 });
  });

  test("soft-delete qilingan qator kalitni bo'shatadi (POST ham 201)", async () => {
    await Attendance.create(row({ lessonType: "amaliy", deletedAt: new Date() }));
    const res = await post(lesson());
    expect(res.status).toBe(201);
    expect(await nativeCount()).toBe(2);
  });
});

describe("POST — ketma-ket takror", () => {
  test("201, keyin 400 {message, reason}; bazada 1 qator", async () => {
    expect((await post(lesson())).status).toBe(201);
    const res = await post(lesson());
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ status: "error", statusCode: 400, detail: "", ...DUP });
    expect(await nativeCount()).toBe(1);
  });

  test("dublikat bo'lmagan xato avvalgidek: 400 «Davomat qo'shishda xato», reason YO'Q", async () => {
    const res = await post(lesson({ resident: "abc" }));
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Davomat qo'shishda xato");
    expect(res.body.detail).toMatch(/Cast to ObjectId/);
    expect(res.body).not.toHaveProperty("reason");
  });
});

const holdGuards = (parties = 2) => {
  const real = Attendance.findOne.bind(Attendance);
  let arrived = 0;
  let openGate;
  const gate = new Promise((resolve) => { openGate = resolve; });
  return jest.spyOn(Attendance, "findOne").mockImplementation((filter, ...rest) => {
    if (!filter || !("lessonType" in filter) || arrived >= parties) return real(filter, ...rest);
    return real(filter, ...rest).then(async (doc) => {
      arrived += 1;
      if (arrived === parties) openGate();
      await gate;
      return doc;
    });
  });
};

const racePosts = async () => {
  const spy = holdGuards();
  try {
    const a = post(lesson()).then((r) => r);
    const b = post(lesson()).then((r) => r);
    return await Promise.all([a, b]);
  } finally {
    spy.mockRestore();
  }
};

describe("POST — poyga (ikkalasi ham qo'riqchidan o'tgan)", () => {
  test("🔴 [201, 400 duplicate_lesson], bazada 1 qator, soat 2 (4 emas)", async () => {
    const results = await racePosts();
    expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
    expect(results.find((r) => r.status === 400).body).toMatchObject(DUP);
    expect(await nativeCount()).toBe(1);
    expect(await countUnexcusedHours(rO._id)).toBe(2);
    expect(await storedHours()).toBe(2);
  });

  test("salbiy nazorat: indekssiz o'sha darvoza IKKI qator yozadi (soat 4)", async () => {
    await Attendance.collection.dropIndex("resident_lesson_unique");
    try {
      const results = await racePosts();
      expect(results.map((r) => r.status)).toEqual([201, 201]);
      expect(await nativeCount()).toBe(2);
      expect(await countUnexcusedHours(rO._id)).toBe(4);
    } finally {
      await Attendance.collection.deleteMany({});
      await Attendance.createIndexes();
    }
    const names = (await Attendance.collection.indexes()).map((i) => i.name);
    expect(names).toContain("resident_lesson_unique");
  });
});

describe("PUT — qatorni mavjud darsning ustiga ko'chirish", () => {
  test("🔴 lessonType boshqa jonli darsga → 400 duplicate_lesson, qator o'zgarmaydi", async () => {
    expect((await post(lesson({ lessonType: "amaliy" }))).status).toBe(201);
    expect((await post(lesson({ lessonType: "maruza" }))).status).toBe(201);
    const second = await Attendance.findOne({ lessonType: "maruza" }).lean();

    const res = await put(second._id, { lessonType: "amaliy", hours: 4 });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject(DUP);
    expect(await Attendance.findById(second._id).lean()).toMatchObject({ lessonType: "maruza", hours: 2 });
  });

  test("o'z darsida qolgan tahrir — 200 (qator o'zi bilan to'qnashmaydi)", async () => {
    expect((await post(lesson({ lessonType: "maruza" }))).status).toBe(201);
    const only = await Attendance.findOne({}).lean();
    const res = await put(only._id, { lessonType: "maruza", hours: 4 });
    expect(res.status).toBe(200);
    expect((await Attendance.findById(only._id).lean()).hours).toBe(4);
  });

  test("dublikat bo'lmagan xato avvalgidek: 400 «Davomatni yangilashda xato»", async () => {
    const res = await put("abc", { hours: 4 });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Davomatni yangilashda xato");
    expect(res.body).not.toHaveProperty("reason");
  });
});
