"use strict";

const express = require("express");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const request = require("supertest");

const { handleError } = require("#shared/error");
const UserModel = require("#modules/4.01-auth/user/user.model");
const RoleModel = require("#modules/4.01-auth/role/role.model");
require("#references/department/department.model");
require("#references/science/science.model");
require("#references/group/group.model");
require("#modules/4.05-residency/residencySpecialty/residencySpecialty.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const attendanceRoutes = require("#modules/4.05-residency/attendance/attendance.routes");

const app = express();
app.use(bodyParser.json());
app.use("/api/attendance", attendanceRoutes);
app.use((err, req, res, next) => handleError(err, res));

const NOT_GRADED = "lesson_type_not_graded";
const SESSION_TEXT =
  "Amaliy mashg'ulotga har dars uchun ball qo'yilmaydi — oraliq nazorat orqali baholanadi";
const DAY = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);

let token;
let rO;
let rM;

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
  rM = await Resident.create({ program: "magistratura", fullName: "Magistrant", courseNumber: 1 });
});

const post = (body) =>
  request(app).post("/api/attendance").set("Authorization", `Bearer ${token}`).send(body);
const put = (id, body) =>
  request(app).put(`/api/attendance/${id}`).set("Authorization", `Bearer ${token}`).send(body);
const legacyRow = (resident, fields) =>
  Attendance.create({
    resident: resident._id,
    date: new Date(DAY),
    lessonType: "amaliy",
    hours: 2,
    status: "present",
    manualVerified: true,
    ...fields,
  });

describe("POST /api/attendance — amaliy + ball", () => {
  it("🔴 magistratura amaliy present + qo'lda tasdiq + 8 → 409, hech narsa yozilmaydi", async () => {
    const res = await post({
      resident: String(rM._id), date: DAY, lessonType: "amaliy", hours: 2,
      status: "present", manualVerified: true, score: 8,
    });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ status: "error", statusCode: 409, reason: NOT_GRADED, detail: NOT_GRADED });
    expect(res.body.message).toBe(SESSION_TEXT);
    expect(await Attendance.countDocuments({})).toBe(0);
  });
});

describe("PUT /api/attendance/:id — amaliy qator", () => {
  it("🔴 eski ordinatura qatori {score:8} → 409, qator o'zgarmaydi", async () => {
    const row = await legacyRow(rO, { score: null });
    const res = await put(row._id, { score: 8 });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ statusCode: 409, reason: NOT_GRADED, message: SESSION_TEXT });
    expect(await Attendance.findById(row._id).lean()).toMatchObject({ lessonType: "amaliy", score: null, hours: 2 });
  });

  it("ballli tarixiy qator {score:null} → 200, ball tozalanadi", async () => {
    const row = await legacyRow(rO, { score: 7 });
    const res = await put(row._id, { score: null });
    expect(res.status).toBe(200);
    expect((await Attendance.findById(row._id).lean()).score).toBeNull();
  });

  it("ballli tarixiy qator {hours:3} → 200, ball saqlanadi (L3-Q14)", async () => {
    const row = await legacyRow(rO, { score: 7 });
    const res = await put(row._id, { hours: 3 });
    expect(res.status).toBe(200);
    expect(await Attendance.findById(row._id).lean()).toMatchObject({ hours: 3, score: 7 });
  });
});

describe("PUT /api/attendance/:id — boshqa dars turi", () => {
  it("maruza qatori {score:8} → 200, avvalgidek", async () => {
    const row = await legacyRow(rM, { lessonType: "maruza", score: null });
    const res = await put(row._id, { score: 8 });
    expect(res.status).toBe(200);
    expect((await Attendance.findById(row._id).lean()).score).toBe(8);
  });
});

describe("PUT /api/attendance/:id — tozalash ball oynasidan o'tadi (L3-Q14)", () => {
  it("ordinatura absent ballli amaliy qator {score:null} → 200, ball tozalanadi", async () => {
    const row = await legacyRow(rO, { status: "absent", manualVerified: false, score: 7 });
    const res = await put(row._id, { score: null });
    expect(res.status).toBe(200);
    expect((await Attendance.findById(row._id).lean()).score).toBeNull();
  });

  it("ordinatura absent ballli amaliy qator {hours:3} → ball oynasi 400 (avvalgidek); ball bilan birga tozalansa 200", async () => {
    const row = await legacyRow(rO, { status: "absent", manualVerified: false, score: 7 });
    expect((await put(row._id, { hours: 3 })).status).toBe(400);
    expect(await Attendance.findById(row._id).lean()).toMatchObject({ hours: 2, score: 7 });

    expect((await put(row._id, { hours: 3, score: null })).status).toBe(200);
    expect(await Attendance.findById(row._id).lean()).toMatchObject({ hours: 3, score: null });
  });
});

const holdFirstWrite = () => {
  const real = Attendance.findOneAndUpdate.bind(Attendance);
  const gate = {};
  gate.reached = new Promise((resolve) => { gate.arrive = resolve; });
  const opened = new Promise((resolve) => { gate.release = resolve; });
  let held = false;
  gate.spy = jest.spyOn(Attendance, "findOneAndUpdate").mockImplementation((...args) => {
    if (held) return real(...args);
    held = true;
    gate.arrive();
    return opened.then(() => real(...args));
  });
  return gate;
};

const racePut = async (id, body, during) => {
  const gate = holdFirstWrite();
  try {
    const held = put(id, body).then((r) => r);
    const early = await Promise.race([gate.reached.then(() => null), held]);
    if (early) throw new Error(`PUT yozuvga yetmadi: ${early.status} ${JSON.stringify(early.body)}`);
    await during();
    gate.release();
    return await held;
  } finally {
    gate.release();
    gate.spy.mockRestore();
  }
};

describe("PUT — parallel ikki eski PUT ballli amaliy qator qoldirmaydi (CAS, L3-Q13)", () => {
  const scoredAmaliy = () => Attendance.countDocuments({ lessonType: "amaliy", score: { $ne: null } });

  it("🔴 {lessonType:amaliy} ushlangan, shu orada {score:8} → 409 state_changed, qator maruza + 8", async () => {
    const row = await legacyRow(rM, { lessonType: "maruza", score: null });
    const res = await racePut(row._id, { lessonType: "amaliy" }, async () => {
      expect((await put(row._id, { score: 8 })).status).toBe(200);
    });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ statusCode: 409, reason: "state_changed" });
    expect(await Attendance.findById(row._id).lean()).toMatchObject({ lessonType: "maruza", score: 8 });
    expect(await scoredAmaliy()).toBe(0);
  });

  it("🔴 {score:8} ushlangan, shu orada {lessonType:amaliy} → 409 state_changed, qator amaliy ballsiz", async () => {
    const row = await legacyRow(rM, { lessonType: "maruza", score: null });
    const res = await racePut(row._id, { score: 8 }, async () => {
      expect((await put(row._id, { lessonType: "amaliy" })).status).toBe(200);
    });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ statusCode: 409, reason: "state_changed" });
    expect(await Attendance.findById(row._id).lean()).toMatchObject({ lessonType: "amaliy", score: null });
    expect(await scoredAmaliy()).toBe(0);
  });

  it("poygasiz {lessonType:amaliy} ballsiz qatorda → 200 (CAS mos keladi)", async () => {
    const row = await legacyRow(rM, { lessonType: "maruza", score: null });
    const res = await racePut(row._id, { lessonType: "amaliy" }, async () => {});
    expect(res.status).toBe(200);
    expect((await Attendance.findById(row._id).lean()).lessonType).toBe("amaliy");
  });
});
