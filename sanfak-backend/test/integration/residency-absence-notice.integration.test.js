"use strict";

const os = require("os");
const path = require("path");
const fs = require("fs");

const FILES_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "abs-notice-"));
process.env.RESIDENCY_NOTICE_FILES_DIR = FILES_DIR;

const express = require("express");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { handleError } = require("#shared/error");
const UserModel = require("#modules/4.01-auth/user/user.model");
const RoleModel = require("#modules/4.01-auth/role/role.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const Notice = require("#modules/4.05-residency/residencyNotice/residencyNotice.model");
const ResidencySetting = require("#modules/4.05-residency/residencySetting/residencySetting.model");
require("#references/science/science.model");
const { uzDayKey } = require("#modules/4.05-residency/_services/uzDay");
const { addDays } = require("#modules/4.05-residency/samsIngest/samsContract");

const app = express();
app.use(bodyParser.json());
app.use("/api/notices", require("#modules/4.05-residency/residencyNotice/residencyNotice.routes"));
app.use(
  "/api/residency-settings",
  require("#modules/4.05-residency/residencySetting/residencySetting.routes"),
);
app.use((err, req, res, next) => handleError(err, res));

const TODAY = uzDayKey(new Date());
const ago = (k) => addDays(TODAY, -k);

let auth;
beforeAll(async () => {
  await Notice.init();
  await Attendance.init();
});
beforeEach(async () => {
  const role = await RoleModel.create({
    title: "magistratura_bolim",
    scopeLevel: "global",
    active: true,
    permissions: [
      { section: "residencyNotice", actionKeys: ["create", "read", "readAll"] },
      { section: "residentAttendance", actionKeys: ["readAll"] },
      { section: "residencyLesson", actionKeys: ["update"] },
    ],
  });
  const user = await UserModel.create({ firstName: "Bo'lim", lastName: "Xodim", role: role._id, active: true });
  auth = `Bearer ${jwt.sign({ _id: String(user._id) }, process.env.JWT_SECRET)}`;
  await ResidencySetting.collection.insertOne({
    workDayFrom: "09:00",
    workDayTo: "14:00",
    absenceStreakDays: 3,
  });
});
afterAll(() => fs.rmSync(FILES_DIR, { recursive: true, force: true }));

const row = (resident, day, status, extra = {}) => ({
  resident: resident._id,
  date: new Date(`${day}T00:00:00.000Z`),
  status,
  hours: 2,
  active: true,
  lessonType: "amaliy",
  ...extra,
});

async function residentWithDays(absentDays, extraRows = []) {
  const r = await Resident.create({ program: "ordinatura", fullName: "Valiyev Ali", courseNumber: 1 });
  await Attendance.insertMany([...absentDays.map((d) => row(r, d, "absent")), ...extraRows.map((f) => f(r))]);
  return r;
}

const streakOf = (r) =>
  request(app).get(`/api/notices/absence-streak?resident=${r._id}`).set("Authorization", auth);
const postDavomat = (r) =>
  request(app).post("/api/notices").set("Authorization", auth).send({
    kind: "davomat",
    resident: String(r._id),
    program: "ordinatura",
    title: "Davomat bildirgisi",
    content: "Kun ora kelmadi.",
  });

describe("ABS — oxirgi 7 kunda ≥ 3 sababsiz kun", () => {
  test("eski singleton: sozlama W=7 bilan o'qiladi (backfill yo'q)", async () => {
    const res = await request(app).get("/api/residency-settings").set("Authorization", auth);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ absenceStreakDays: 3, absenceWindowDays: 7 });
  });

  test("kun ora 3 kun -> ochiq; o'chirilgan va nofaol qatorlar sanalmaydi; POST snapshot; lastNotice", async () => {
    const r = await residentWithDays(
      [ago(6), ago(4), ago(2)],
      [
        (res) => row(res, ago(5), "present"),
        (res) => row(res, ago(1), "absent", { deletedAt: new Date() }),
        (res) => row(res, ago(3), "absent", { active: false }),
        (res) => row(res, ago(9), "absent"),
      ],
    );

    const first = await streakOf(r);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      days: 3,
      threshold: 3,
      eligible: true,
      windowDays: 7,
      windowFrom: ago(7),
      windowTo: ago(1),
      dayKeys: [ago(6), ago(4), ago(2)],
      lastNotice: null,
    });

    const created = await postDavomat(r);
    expect(created.status).toBe(201);
    const saved = await Notice.findById(created.body.id).lean();
    expect(saved.absence).toEqual({
      days: 3,
      from: ago(6),
      to: ago(2),
      windowDays: 7,
      windowFrom: ago(7),
      windowTo: ago(1),
    });
    expect(saved.document?.sha256).toMatch(/^[0-9a-f]{64}$/);

    const again = await streakOf(r);
    expect(again.body.lastNotice).toMatchObject({
      id: String(created.body.id),
      days: 3,
      from: ago(6),
      to: ago(2),
    });
  });

  test("2 kun — 400 aniq matn, bildirgi yozilmaydi", async () => {
    const r = await residentWithDays([ago(4), ago(2)]);
    const res = await postDavomat(r);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      "Davomat bildirgisi oxirgi 7 kunda kamida 3 kun sababsiz qoldirilganda yuboriladi (hozir: 2 kun)",
    );
    await expect(Notice.countDocuments({ kind: "davomat" })).resolves.toBe(0);
  });

  test("sozlama: qisman N=8 (W=7 saqlangan) — 400; W=10 yoziladi va o'qiladi", async () => {
    const bad = await request(app)
      .put("/api/residency-settings")
      .set("Authorization", auth)
      .send({ absenceStreakDays: 8 });
    expect(bad.status).toBe(400);
    expect(bad.body.message).toBe("Sababsiz kunlar soni oyna kunlaridan ko'p bo'lmasligi kerak");

    const ok = await request(app)
      .put("/api/residency-settings")
      .set("Authorization", auth)
      .send({ absenceWindowDays: 10 });
    expect(ok.status).toBe(200);
    const read = await request(app).get("/api/residency-settings").set("Authorization", auth);
    expect(read.body.absenceWindowDays).toBe(10);
  });
});
