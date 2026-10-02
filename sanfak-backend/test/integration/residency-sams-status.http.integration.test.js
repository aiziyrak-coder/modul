"use strict";

const H = require("./helpers/samsIngest");
const express = require("express");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { handleError } = require("#shared/error");
const UserModel = require("#modules/4.01-auth/user/user.model");
const RoleModel = require("#modules/4.01-auth/role/role.model");
require("#references/department/department.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const SamsAlert = require("#modules/4.05-residency/samsIngest/samsAlert.model");
const { addDays } = require("#modules/4.05-residency/samsIngest/samsContract");
const M = require("./helpers/samsMonitor");

const app = express();
app.use(bodyParser.json());
app.use("/api/residency-sams", require("#modules/4.05-residency/samsIngest/samsIngest.routes"));
app.use("/api/residency-sams-status", require("#modules/4.05-residency/samsIngest/samsStatus.routes"));
app.use((err, req, res, next) => handleError(err, res));

const ROOT = "/api/residency-sams-status";
const { today } = H;
const D = (n) => addDays(today, n);
const finalStamp = (day) => ({ packetAt: M.finalAt(day), receivedAt: M.finalAt(day) });
const fresh = () => ({ packetAt: new Date(Date.now() - 60_000), receivedAt: new Date(Date.now() - 30_000) });

async function createUser(title, permissions) {
  const role = await RoleModel.create({ title, permissions, scopeLevel: title === "klinik_ustoz" ? "self" : "global", active: true });
  const user = await UserModel.create({ firstName: "Test", lastName: title, role: role._id, active: true });
  return { user, auth: `Bearer ${jwt.sign({ _id: String(user._id) }, process.env.JWT_SECRET)}` };
}

let office;
let ustoz;
let mine;
let other;
beforeEach(async () => {
  office = await createUser("magistratura_bolim", [
    { section: "residencyLesson", actionKeys: ["update"] },
    { section: "residentAttendance", actionKeys: ["readAll"] },
  ]);
  ustoz = await createUser("klinik_ustoz", [{ section: "residentAttendance", actionKeys: ["readAll"] }]);
  mine = await M.mkResident({ supervisor: ustoz.user._id, fullName: "Aliyev Vali" });
  other = await M.mkResident({ fullName: "Boboyev Soli" });
  for (let n = -6; n <= -1; n += 1) {
    await M.orgDay("A", D(n), finalStamp(D(n)));
    await M.presence(mine, "A", D(n), finalStamp(D(n)), n <= -4 ? M.withRecords() : {});
  }
  await M.orgDay("A", today, fresh());
  await M.presence(mine, "A", today, fresh(), M.withRecords(2));
  await M.presence(other, "A", today, fresh(), { measured: false, unmeasuredReason: "no_schedule", samsUserActive: false });
});

const get = (path, who = office) => request(app).get(`${ROOT}${path}`).set("Authorization", who.auth);

describe("darvoza, ruxsat va prefiks", () => {
  it("tokensiz — 401; `/residency-sams` kalit darvozasi `-status` ni tutmaydi", async () => {
    expect((await request(app).get(`${ROOT}/overview`)).status).toBe(401);
    expect((await request(app).get("/api/residency-sams/roster")).body.reason).toBe("sams_key_invalid");
    const ok = await get("/overview");
    expect(ok.status).toBe(200);
    expect(ok.headers["cache-control"]).toBe("no-store");
  });

  it.each(["/overview", "/days", "/warnings", `/clinics/A/days/${D(-1)}`])("%s — faqat readAll (ustoz) → 403", async (path) => {
    expect((await get(path, ustoz)).status).toBe(403);
  });

  it.each([
    ["/days?from=2026-09-27&to=2026-09-26", 400],
    ["/days?from=2026-01-01&to=2026-04-01", 400],
    ["/warnings?day=2026-02-30", 400],
    ["/overview?x=1", 400],
    [`/clinics/A/days/${D(-1)}?limit=201`, 400],
    ["/residents/123/baseline", 400],
  ])("%s → %s", async (path, code) => {
    expect((await get(path)).status).toBe(code);
  });
});

describe("200 shakllar", () => {
  it("overview: jonlilik, watermark, klinika bugun, ogohlantirish sonlari", async () => {
    const { body } = await get("/overview");
    expect(Object.keys(body).sort()).toEqual(["clinics", "config", "delivery", "liveness", "now", "today", "warnings"]);
    expect(body.config).toEqual({ tickMinutes: 15, staleAfterMinutes: 30, closeGraceHours: 6, resendMaxDays: 30 });
    expect(body.delivery).toEqual({ deliveredThrough: D(-1), resendFrom: null, gapDays: 0, oldestGap: null });
    expect(body.clinics).toEqual([expect.objectContaining({ dbname: "A", orgTitle: "Klinika A", live: true, firstDay: D(-6), gapCount: 0 })]);
    expect(body.clinics[0].today).toMatchObject({ delivery: "open", measured: true, coverage: 0.8, coverageStatus: "provisional" });
    expect(body.warnings).toMatchObject({ day: today, unresolved: 0, noSchedule: 1, inactiveUser: 1, tenantSetChanged: null });
    expect(body.liveness.state).toBe("never");
  });

  it("days: matritsa, not_started, qamrov holati; klinika lastPacketAt (F4 grid)", async () => {
    const { body } = await get(`/days?from=${D(-8)}&to=${today}&dbname=A`);
    expect(body).toMatchObject({ from: D(-8), to: today, deliveredThrough: D(-1), resendFrom: null });
    const [a] = body.clinics;
    expect(a).toMatchObject({ dbname: "A", live: true, firstDay: D(-6), deliveredThrough: D(-1) });
    expect(a.lastPacketAt).toEqual(expect.any(String));
    expect(a.lastPacketAt).toBe((await get("/overview")).body.clinics[0].lastPacketAt);
    expect(a.gaps).toEqual([]);
    expect(a.days.map((d) => d.delivery)).toEqual(["not_started", "not_started", "final", "final", "final", "final", "final", "final", "open"]);
    expect(a.days[2]).toMatchObject({ coverage: 0.8, coverageStatus: "no_baseline", rosterScanCount: 8, deviceMix: expect.any(Object) });
  });

  it("warnings: guruhlangan, to'liq JSHSHIR, isNew va digestDay", async () => {
    await SamsAlert.create({ key: `digest:${D(-1)}`, kind: "digest", day: D(-1), payload: { keys: [`inactive_user:${other._id}`], gapKeys: [] } });
    const { body } = await get("/warnings");
    expect(body).toMatchObject({ day: today, digestDay: D(-1), tenantSetChanged: { changes: [] } });
    expect(body.noSchedule.groups).toEqual([{ dbname: "A", orgTitle: "Klinika A", residents: [{ resident: String(other._id), fullName: "Boboyev Soli", jshshir: other.jshshir, isNew: true }] }]);
    expect(body.inactiveUser.groups[0].residents[0].isNew).toBe(false);
  });

  it("clinic-day: shubhalilar tepada, yozuvlar, sahifalash", async () => {
    const { body } = await get(`/clinics/A/days/${today}?page=1&limit=1`);
    expect(body).toMatchObject({ dbname: "A", orgTitle: "Klinika A", day: today, totalDocs: 2, page: 1, limit: 1, totalPages: 2 });
    expect(body.org).toMatchObject({ delivery: "open", coverageStatus: "provisional" });
    expect(body.docs[0]).toMatchObject({ resident: String(mine._id), recordCount: 2, baseline: { silentStreak: 3, lastRecordDay: D(-4) } });
    expect(body.docs[0].records[0]).toEqual({ accessTime: "08:00", exitTime: "14:00", deviceType: [{ device: 1, type: 1 }] });
  });
});

describe("rezident bazaviy chizig'i — doira", () => {
  it("ustoz o'z rezidenti → 200; boshqasi → 403", async () => {
    const res = await get(`/residents/${mine._id}/baseline`, ustoz);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ resident: String(mine._id), from: D(-46), to: D(-1), dbname: "A", orgTitle: "Klinika A", silentStreak: 3, eligibleDays: 6 });
    expect(res.body.days[0]).toEqual({ day: D(-6), measured: true, unmeasuredReason: null, delivery: "final", clinicAlive: true, hasRecords: true });
    expect((await get(`/residents/${other._id}/baseline`, ustoz)).body.reason).toBe("resident_out_of_scope");
  });

  it("o'chirilgan rezident → 403; noma'lum id → 404", async () => {
    await Resident.collection.updateOne({ _id: other._id }, { $set: { deletedAt: new Date() } });
    expect((await get(`/residents/${other._id}/baseline`)).status).toBe(403);
    const missing = await get("/residents/507f1f77bcf86cd799439011/baseline");
    expect([missing.status, missing.body.reason]).toEqual([404, "resident_not_found"]);
  });
});
