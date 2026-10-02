"use strict";

const express = require("express");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { handleError } = require("#shared/error");
const UserModel = require("#modules/4.01-auth/user/user.model");
const RoleModel = require("#modules/4.01-auth/role/role.model");
require("#references/department/department.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const { todayUz } = require("#modules/4.05-residency/_services/sessionDay");
const { addDays } = require("#modules/4.05-residency/samsIngest/samsContract");
const { GRANTS } = require("../../seed/residency-roles.seed");

const app = express();
app.use(bodyParser.json());
app.use("/api/attendance", require("#modules/4.05-residency/attendance/attendance.routes"));
app.use((err, req, res, next) => handleError(err, res));

async function office() {
  const permissions = Object.entries(GRANTS.magistratura_bolim).map(([section, actionKeys]) => ({ section, actionKeys }));
  const role = await RoleModel.create({ title: "magistratura_bolim", permissions, scopeLevel: "global", active: true });
  const user = await UserModel.create({ firstName: "Test", lastName: "Bolim", middleName: "X", role: role._id, active: true });
  return `Bearer ${jwt.sign({ _id: String(user._id) }, process.env.JWT_SECRET)}`;
}
const mkResident = () =>
  Resident.create({ program: "ordinatura", fullName: "Rezident Bir", courseNumber: 1, status: "oquvda", active: true });
const legacyPresent = (r, day, checkInTime, checkOutTime) =>
  Attendance.create({
    resident: r._id, date: new Date(`2026-10-${day}T00:00:00.000Z`), status: "present", hours: 2,
    manualVerified: true, checkInTime, checkOutTime,
  });

let auth;
beforeEach(async () => {
  auth = await office();
});
const put = (id, body) => request(app).put(`/api/attendance/${id}`).set("Authorization", auth).send(body);

describe("I4 — ball oynasi kesishmaga (D-TIME, Q3=A)", () => {
  test("08:30–09:30 (ish kuni 09:00–14:00 bilan kesishadi) — 200, ball yoziladi", async () => {
    const row = await legacyPresent(await mkResident(), "05", "08:30", "09:30");
    const res = await put(row._id, { score: 8 });
    expect(res.status).toBe(200);
    expect(await Attendance.findById(row._id).lean()).toMatchObject({ score: 8, checkInTime: "08:30", checkOutTime: "09:30" });
  });

  test("15:00–16:00 (kesishmaydi) — 400, oyna matnda, ball yozilmaydi", async () => {
    const row = await legacyPresent(await mkResident(), "06", "15:00", "16:00");
    const res = await put(row._id, { score: 8 });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("09:00–14:00");
    expect(res.body.message).toContain("klinikada bo'lgani qayd etilmagan");
    expect((await Attendance.findById(row._id).lean()).score).toBeNull();
  });

  test("chegaraga tegish (08:00–09:00) — 400", async () => {
    const row = await legacyPresent(await mkResident(), "07", "08:00", "09:00");
    expect((await put(row._id, { score: 8 })).status).toBe(400);
  });
});

describe("I5 — `checkInTime`/`checkOutTime` server-only (yuborilsa jimgina tashlanadi)", () => {
  const TIMES = { checkInTime: "10:00", checkOutTime: "11:00" };

  test("PUT vaqt + ball — 200, saqlangan vaqtlar o'zgarmaydi", async () => {
    const row = await legacyPresent(await mkResident(), "08", "08:30", "09:30");
    const res = await put(row._id, { ...TIMES, score: 8 });
    expect(res.status).toBe(200);
    expect(await Attendance.findById(row._id).lean()).toMatchObject({ score: 8, checkInTime: "08:30", checkOutTime: "09:30" });
  });

  test("🔴 PUT dagi vaqt oynani «to'g'rilay» olmaydi — saqlangan 15:00–16:00 bilan 400", async () => {
    const row = await legacyPresent(await mkResident(), "09", "15:00", "16:00");
    const res = await put(row._id, { ...TIMES, score: 8 });
    expect(res.status).toBe(400);
    expect(await Attendance.findById(row._id).lean()).toMatchObject({ score: null, checkInTime: "15:00", checkOutTime: "16:00" });
  });

  test("POST vaqtlar bilan — 201 (400 EMAS), saqlangan juftlik null", async () => {
    const r = await mkResident();
    const res = await request(app).post("/api/attendance").set("Authorization", auth)
      .send({ resident: String(r._id), date: addDays(todayUz(), -3), status: "absent", hours: 2, ...TIMES });
    expect(res.status).toBe(201);
    const [row] = await Attendance.find({ resident: r._id }).lean();
    expect([row.checkInTime, row.checkOutTime]).toEqual([null, null]);
  });
});
