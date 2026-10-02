"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
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

const SAMS_ONLY = "present_requires_sams";
const NEEDS_EVIDENCE = "present_requires_verification";
const DAY = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);

let token;
let userId;
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
  userId = String(user._id);
  token = jwt.sign({ _id: userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
  rO = await Resident.create({ program: "ordinatura", fullName: "Ordinator", courseNumber: 1 });
  rM = await Resident.create({ program: "magistratura", fullName: "Magistrant", courseNumber: 1 });
});

const post = (body) =>
  request(app).post("/api/attendance").set("Authorization", `Bearer ${token}`).send(body);
const put = (id, body) =>
  request(app).put(`/api/attendance/${id}`).set("Authorization", `Bearer ${token}`).send(body);
const lesson = (resident, extra) => ({
  resident: String(resident._id),
  date: DAY,
  lessonType: "amaliy",
  hours: 2,
  ...extra,
});
const legacyRow = (resident, flags) =>
  Attendance.create({
    resident: resident._id,
    date: new Date(DAY),
    lessonType: "amaliy",
    hours: 2,
    status: "present",
    ...flags,
  });

describe("POST /api/attendance", () => {
  it("🔴 ordinatura present + SAMS/qo'lda da'vo → 400 present_requires_sams, hech narsa yozilmaydi", async () => {
    const res = await post(lesson(rO, { status: "present", samsVerified: true, manualVerified: true }));

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ status: "error", statusCode: 400, reason: SAMS_ONLY });
    expect(res.body.message).toMatch(/faqat SAMS/);
    expect(await Attendance.countDocuments({})).toBe(0);
  });

  it("ordinatura absent + samsVerified:true → 201, bazada bayroqlar false", async () => {
    const res = await post(lesson(rO, { status: "absent", samsVerified: true, manualVerified: true }));

    expect(res.status).toBe(201);
    const row = await Attendance.findOne({ resident: rO._id }).lean();
    expect(row.samsVerified).toBe(false);
    expect(row.manualVerified).toBe(false);
    expect(row.manualVerifiedBy).toBeNull();
  });

  it("magistratura present + faqat samsVerified → 400 present_requires_verification", async () => {
    const res = await post(lesson(rM, { status: "present", samsVerified: true }));
    expect(res.status).toBe(400);
    expect(res.body.reason).toBe(NEEDS_EVIDENCE);
    expect(res.body.message).toBe("Kelganini tasdiqlash uchun SAMS ilovasi yoki qo'lda tasdiq kerak");
  });

  it("magistratura present + qo'lda tasdiq → 201, tasdiqlovchi = so'rov egasi", async () => {
    const res = await post(lesson(rM, { status: "present", manualVerified: true }));

    expect(res.status).toBe(201);
    const row = await Attendance.findOne({ resident: rM._id }).lean();
    expect(row).toMatchObject({ status: "present", samsVerified: false, manualVerified: true });
    expect(String(row.manualVerifiedBy)).toBe(userId);
    expect(row.manualVerifiedAt).toBeInstanceOf(Date);
  });
});

describe("PUT /api/attendance/:id", () => {
  it("🔴 ordinatura absent → present (bayroqlar bilan) → 400, yozuv o'zgarmaydi", async () => {
    const row = await legacyRow(rO, { status: "absent" });
    const res = await put(row._id, { status: "present", samsVerified: true, manualVerified: true });

    expect(res.status).toBe(400);
    expect(res.body.reason).toBe(SAMS_ONLY);
    const after = await Attendance.findById(row._id).lean();
    expect(after).toMatchObject({ status: "absent", samsVerified: false, manualVerified: false });
  });

  it("eski qo'lda tasdiqli ordinatura present — ball qo'yiladi", async () => {
    const row = await legacyRow(rO, { lessonType: "maruza", manualVerified: true });
    const res = await put(row._id, { score: 8 });
    expect(res.status).toBe(200);
    expect((await Attendance.findById(row._id)).score).toBe(8);
  });

  it("eski (P11 dan oldingi) samsVerified dalili ham kuchda", async () => {
    const row = await legacyRow(rO, { lessonType: "maruza", samsVerified: true });
    const res = await put(row._id, { score: 7 });
    expect(res.status).toBe(200);
    expect((await Attendance.findById(row._id)).score).toBe(7);
  });

  it("ordinaturada qo'lda tasdiqni olib tashlash e'tiborsiz — bayroq true qoladi", async () => {
    const row = await legacyRow(rO, { manualVerified: true });
    const res = await put(row._id, { manualVerified: false });
    expect(res.status).toBe(200);
    expect((await Attendance.findById(row._id)).manualVerified).toBe(true);
  });

  it("noma'lum kalit (`application`) hamon birinchi qatlamda 400", async () => {
    const row = await legacyRow(rO, { status: "absent" });
    const res = await put(row._id, { application: String(row._id) });
    expect(res.status).toBe(400);
    expect((await Attendance.findById(row._id)).application).toBeNull();
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
    await gate.reached;
    await during();
    gate.release();
    return await held;
  } finally {
    gate.spy.mockRestore();
  }
};

describe("PUT — o'qish va yozish orasidagi poyga (CAS, 409 state_changed)", () => {
  const noEvidencePresent = () =>
    Attendance.countDocuments({ status: "present", samsVerified: { $ne: true }, manualVerified: { $ne: true } });

  it("🔴 P11 --apply qatorni qayta belgilasa — tasdiqni olib tashlash 409, dalil saqlanadi", async () => {
    const { migrate } = require("../../scripts/migrate-45-sams-verified");
    const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), "p7-race-"));
    const row = await legacyRow(rM, { samsVerified: true, manualVerified: false });
    try {
      const res = await racePut(row._id, { manualVerified: false }, async () => {
        const r = await migrate({ apply: true, backupDir });
        expect(r.applied).toMatchObject({ modified: 1, raced: 0 });
      });
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ statusCode: 409, reason: "state_changed" });
    } finally {
      fs.rmSync(backupDir, { recursive: true, force: true });
    }
    expect(await Attendance.findById(row._id).lean()).toMatchObject({ samsVerified: false, manualVerified: true });
    expect(await noEvidencePresent()).toBe(0);
  });

  it("🔴 PUT present ushlangan, shu orada tasdiq olinadi → 409, qator absent qoladi", async () => {
    const row = await legacyRow(rM, { status: "absent", manualVerified: true });
    const res = await racePut(row._id, { status: "present" }, async () => {
      expect((await put(row._id, { manualVerified: false })).status).toBe(200);
    });
    expect(res.status).toBe(409);
    expect(await Attendance.findById(row._id).lean()).toMatchObject({ status: "absent", manualVerified: false });
  });

  it("🔴 tasdiqni olish ushlangan, shu orada present qilinadi → 409, dalil saqlanadi", async () => {
    const row = await legacyRow(rM, { status: "absent", manualVerified: true });
    const res = await racePut(row._id, { manualVerified: false }, async () => {
      expect((await put(row._id, { status: "present" })).status).toBe(200);
    });
    expect(res.status).toBe(409);
    expect(await Attendance.findById(row._id).lean()).toMatchObject({ status: "present", manualVerified: true });
    expect(await noEvidencePresent()).toBe(0);
  });

  it("poygasiz tahrir avvalgidek 200 (CAS mos keladi)", async () => {
    const row = await legacyRow(rM, { lessonType: "maruza", samsVerified: true, manualVerified: false });
    const res = await racePut(row._id, { score: 9 }, async () => {});
    expect(res.status).toBe(200);
    expect((await Attendance.findById(row._id)).score).toBe(9);
  });
});
