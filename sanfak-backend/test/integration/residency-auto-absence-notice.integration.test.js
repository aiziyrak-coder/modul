"use strict";

const os = require("os");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const FILES_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "p10-auto-notice-"));
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
const Notification = require("#system/notification/notification.model");
const { dispatch } = require("#system/notification/notificationDispatcher");
const noticeFiles = require("#modules/4.05-residency/_services/noticeFiles");
const { runExpulsionSweep } = require("#modules/4.05-residency/_services/expulsionCheck");
const auto = require("#modules/4.05-residency/_services/autoAbsenceNotice");
const {
  currentAcademicYearTitle,
  currentAcademicYearWindow,
} = require("#modules/4.05-residency/_services/unexcusedWindow");

const app = express();
app.use(bodyParser.json());
app.use("/api/notices", require("#modules/4.05-residency/residencyNotice/residencyNotice.routes"));
app.use((err, req, res, next) => handleError(err, res));

const DAY = 24 * 3600 * 1000;
const WIN = currentAcademicYearWindow();
const YEAR = currentAcademicYearTitle();
const OFFICE_GRANTS = ["read", "readAll", "update", "delete", "approve"];
const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const blobs = (dir = FILES_DIR) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? blobs(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );
const alertsOf = (id) =>
  Notification.find({ eventType: auto.AUTO_EVENT_TYPE, "metadata.noticeId": String(id) }).lean();
const autoNotices = () => Notice.find({ kind: "avtomatik" }).sort({ createdAt: 1, _id: 1 }).lean();

async function userWithRole(title, actionKeys, scopeLevel = "global") {
  const role =
    (await RoleModel.findOne({ title })) ||
    (await RoleModel.create({ title, permissions: [{ section: "residencyNotice", actionKeys }], scopeLevel, active: true }));
  const user = await UserModel.create({ firstName: "Test", lastName: title, role: role._id, active: true });
  return { user, auth: `Bearer ${jwt.sign({ _id: String(user._id) }, process.env.JWT_SECRET)}` };
}

async function addRows(r, hours, dayOffset, status = "absent") {
  const docs = hours.map((h, i) => ({
    resident: r._id,
    date: new Date(WIN.from.getTime() + (dayOffset + i) * DAY),
    status,
    hours: h,
    active: true,
    lessonType: "amaliy",
  }));
  return Attendance.insertMany(docs);
}

async function residentWith(hours, extra = {}, dayOffset = 5) {
  const r = await Resident.create({ program: "ordinatura", fullName: "Valiyev Ali", courseNumber: 1, ...extra });
  await addRows(r, hours, dayOffset);
  return r;
}

function holdFirst(obj, method) {
  const original = obj[method].bind(obj);
  let release;
  let reached;
  const gate = new Promise((res) => {
    release = res;
  });
  const arrived = new Promise((res) => {
    reached = res;
  });
  jest.spyOn(obj, method).mockImplementationOnce(async (...args) => {
    reached();
    await gate;
    return original(...args);
  });
  return { arrived, release };
}

let office;
beforeAll(async () => {
  await Notice.init();
  await Attendance.init();
});
beforeEach(async () => {
  office = [await userWithRole("magistratura_bolim", OFFICE_GRANTS), await userWithRole("magistratura_bolim", OFFICE_GRANTS)];
});
afterEach(() => jest.restoreAllMocks());
afterAll(() => fs.rmSync(FILES_DIR, { recursive: true, force: true }));

describe("A — yaratish va e'lon (to'liq sweep)", () => {
  test("6 soat: bitta bildirgi, PDF diskda (sha256), bo'limga bittadan xabar; ikkinchi sweep — o'zgarishsiz", async () => {
    const r = await residentWith([2, 2, 2]);
    await expect(runExpulsionSweep()).resolves.toBe(true);
    const [n, ...rest] = await autoNotices();
    expect(rest).toHaveLength(0);
    expect(n).toMatchObject({
      sender: null,
      senderName: "Tizim (avtomatik)",
      program: "ordinatura",
      academicYear: YEAR,
      status: "yangi",
      title: auto.AUTO_TITLE,
      absence: null,
      auto: { countingYear: YEAR, state: "faol", hoursAtIssue: 6, templateVersion: 1, revokedAt: null, hoursAtRevoke: null },
    });
    expect(String(n.resident)).toBe(String(r._id));
    expect(n.auto.notifiedAt).toBeInstanceOf(Date);
    expect(n.document.fileName).toMatch(/^bildirgi-avtomatik-\d{4}-\d{2}-\d{2}\.pdf$/);
    const file = fs.readFileSync(noticeFiles.resolveAbsolute(n.document.storageKey));
    expect(file.slice(0, 5).toString()).toBe("%PDF-");
    expect([sha(file), file.length]).toEqual([n.document.sha256, n.document.size]);
    const alerts = await alertsOf(n._id);
    expect(alerts.map((a) => String(a.user)).sort()).toEqual(office.map((o) => String(o.user._id)).sort());
    for (const a of alerts) {
      expect(a).toMatchObject({ active: true, link: `/residency/bildirgilar?notice=${n._id}`, channels: ["inApp"] });
      expect(a.metadata).toEqual({ residentId: String(r._id), noticeId: String(n._id) });
    }
    await expect(runExpulsionSweep()).resolves.toBe(true);
    expect(await Notice.countDocuments({ kind: "avtomatik" })).toBe(1);
    expect(await alertsOf(n._id)).toHaveLength(2);
  });
});

describe("B — bekor qilish va qayta yaratish", () => {
  test("sababli bo'ldi (4 soat): bekor, dalil qoladi, xabarlar olinadi; qayta 8 — YANGI bildirgi", async () => {
    const r = await residentWith([2, 2, 2]);
    await runExpulsionSweep();
    const [first] = await autoNotices();
    const row = await Attendance.findOne({ resident: r._id }).lean();
    await Attendance.updateOne({ _id: row._id }, { $set: { status: "excused" } });
    await expect(runExpulsionSweep()).resolves.toBe(true);
    const revoked = await Notice.findById(first._id).lean();
    expect(revoked.auto).toMatchObject({ state: "bekor_qilingan", hoursAtRevoke: 4, notifiedAt: first.auto.notifiedAt });
    expect(revoked.auto.revokedAt).toBeInstanceOf(Date);
    expect(revoked.document).toEqual(first.document);
    expect(fs.existsSync(noticeFiles.resolveAbsolute(first.document.storageKey))).toBe(true);
    expect((await alertsOf(first._id)).map((a) => a.active)).toEqual([false, false]);

    await addRows(r, [2, 2], 30);
    await runExpulsionSweep();
    const all = await autoNotices();
    expect(all.map((x) => x.auto.state)).toEqual(["bekor_qilingan", "faol"]);
    expect(all[1].auto.hoursAtIssue).toBe(8);
    expect((await alertsOf(all[1]._id)).filter((a) => a.active)).toHaveLength(2);
  });
});

describe("C — kimga bildirgi YO'Q", () => {
  test("5 soat, ta'til, chetlatilgan, nofaol, o'chirilgan, o'tgan yil, sababli/kelgan", async () => {
    await residentWith([2, 3]);
    await residentWith([4, 4], { status: "akademik_tatil" });
    await residentWith([4, 4], { status: "chetlatilgan" });
    await residentWith([4, 4], { active: false });
    const gone = await residentWith([4, 4]);
    await Resident.collection.updateOne({ _id: gone._id }, { $set: { deletedAt: new Date() } });
    await residentWith([4, 4], {}, -40);
    const other = await Resident.create({ program: "magistratura", fullName: "Boshqa", courseNumber: 1 });
    await addRows(other, [4, 4], 5, "excused");
    await addRows(other, [4, 4], 10, "present");
    await expect(runExpulsionSweep()).resolves.toBe(true);
    expect(await Notice.countDocuments({ kind: "avtomatik" })).toBe(0);
    expect(await Notification.countDocuments({ eventType: auto.AUTO_EVENT_TYPE })).toBe(0);
  });
});

describe("D — o'quv yili almashdi", () => {
  test("o'tgan yil bildirgisi bekor ham, e'lon ham qilinmaydi; yangisi yo'q", async () => {
    await UserModel.updateMany({}, { $set: { active: false } });
    const r = await residentWith([2, 2, 2]);
    await runExpulsionSweep();
    const [n] = await autoNotices();
    expect(n.auto.notifiedAt).toBeNull();
    await Resident.updateOne({ _id: r._id }, { $set: { totalUnexcusedHours: 0 } });
    await UserModel.updateMany({}, { $set: { active: true } });
    const nextYear = new Date(WIN.to.getTime() + 10 * DAY);
    await expect(auto.syncAbsenceNotices(nextYear)).resolves.toEqual({ issued: 0, revoked: 0, announced: 0 });
    const after = await Notice.findById(n._id).lean();
    expect(after.auto).toMatchObject({ state: "faol", notifiedAt: null });
    expect(await Notice.countDocuments({ kind: "avtomatik" })).toBe(1);
    expect(await alertsOf(n._id)).toHaveLength(0);
  });
});

describe("E — e'lon keyingi sweep'ga qoladi", () => {
  test("bo'lim bo'sh: yaratiladi, band qilinmaydi; xodim paydo bo'lgach BIR marta e'lon", async () => {
    await UserModel.updateMany({}, { $set: { active: false } });
    await residentWith([2, 2, 2]);
    await runExpulsionSweep();
    const [n] = await autoNotices();
    expect(n.auto.notifiedAt).toBeNull();
    await UserModel.updateMany({}, { $set: { active: true } });
    await runExpulsionSweep();
    await runExpulsionSweep();
    expect((await Notice.findById(n._id).lean()).auto.notifiedAt).toBeInstanceOf(Date);
    expect(await alertsOf(n._id)).toHaveLength(2);
  });

  test("hech kimga saqlanmadi — band qilish qaytariladi, keyingi ishga tushish e'lon qiladi", async () => {
    await residentWith([2, 2, 2], { totalUnexcusedHours: 6 });
    const now = new Date();
    await auto.syncAbsenceNotices(now, { send: async () => ({ notification: null }) });
    const [n] = await autoNotices();
    expect(n.auto.notifiedAt).toBeNull();
    await expect(auto.syncAbsenceNotices(new Date())).resolves.toMatchObject({ issued: 0, announced: 1 });
    expect(await alertsOf(n._id)).toHaveLength(2);
  });
});

describe("F–H — poygalar (darvoza bilan)", () => {
  const recipients = () => office.map((o) => o.user._id);
  const issue = async (r, now = new Date()) =>
    (await auto.issueOne(r._id, { year: currentAcademicYearTitle(now), now })).toObject();

  test("F — ikki parallel yaratish: bitta bildirgi, yutqazgan `null` (fayli yetim qoladi)", async () => {
    const r = await residentWith([2, 2, 2]);
    const before = blobs().length;
    const hold = holdFirst(noticeFiles, "save");
    const now = new Date();
    const a = auto.issueOne(r._id, { year: YEAR, now });
    await hold.arrived;
    const b = await auto.issueOne(r._id, { year: YEAR, now });
    hold.release();
    await expect(a).resolves.toBeNull();
    expect(b).not.toBeNull();
    expect(await Notice.countDocuments({ kind: "avtomatik", resident: r._id })).toBe(1);
    expect(blobs().length - before).toBe(2);
  });

  test("G — ikki parallel e'lon: har xodimga bittadan", async () => {
    const n = await issue(await residentWith([2, 2, 2]));
    const box = { send: dispatch };
    const gated = holdFirst(box, "send");
    const now = new Date();
    const a = auto.announceOne(n, { recipients: recipients(), send: box.send, now, name: "Valiyev Ali" });
    await gated.arrived;
    await expect(auto.announceOne(n, { recipients: recipients(), now, name: "Valiyev Ali" })).resolves.toBe(false);
    gated.release();
    await expect(a).resolves.toBe(true);
    expect(await alertsOf(n._id)).toHaveLength(2);
  });

  test("H — e'lon paytida bekor qilindi: oxirida barcha xabarlar nofaol", async () => {
    const r = await residentWith([2, 2, 2]);
    const n = await issue(r);
    const box = { send: dispatch };
    const gated = holdFirst(box, "send");
    const now = new Date();
    const a = auto.announceOne(n, { recipients: recipients(), send: box.send, now, name: "Valiyev Ali" });
    await gated.arrived;
    const row = await Attendance.findOne({ resident: r._id }).lean();
    await Attendance.updateOne({ _id: row._id }, { $set: { status: "excused" } });
    await expect(auto.revokeOne(n, now)).resolves.toBe(true);
    gated.release();
    await expect(a).resolves.toBe(true);
    const alerts = await alertsOf(n._id);
    expect(alerts).toHaveLength(2);
    expect(alerts.every((x) => x.active === false)).toBe(true);
  });
});

describe("I — HTTP: faqat o'qish; ko'rish, qaror va PDF ishlaydi", () => {
  let n;
  beforeEach(async () => {
    await residentWith([2, 2, 2]);
    await runExpulsionSweep();
    [n] = await autoNotices();
  });
  const as = (who) => ({ Authorization: who.auth });
  const binary = (req) =>
    req.buffer(true).parse((res, cb) => {
      const parts = [];
      res.on("data", (c) => parts.push(c));
      res.on("end", () => cb(null, Buffer.concat(parts)));
    });

  test("`?kind=avtomatik` filtrlaydi; PDF — `attachment`, bayt bazadagi sha256 bilan", async () => {
    await Notice.create({ sender: office[0].user._id, program: "ordinatura", title: "Qo'lda", content: "x" });
    const all = await request(app).get("/api/notices").set(as(office[0]));
    const only = await request(app).get("/api/notices?kind=avtomatik").set(as(office[0]));
    expect([all.status, only.status]).toEqual([200, 200]);
    expect(all.body).toHaveLength(2);
    expect(only.body.map((d) => d._id)).toEqual([String(n._id)]);
    const pdf = await binary(request(app).get(`/api/notices/${n._id}/pdf`).set(as(office[0])));
    expect(pdf.status).toBe(200);
    expect(pdf.headers["content-type"]).toMatch(/application\/octet-stream/);
    expect(pdf.headers["content-disposition"]).toMatch(/^attachment; filename="bildirgi-avtomatik-\d{4}-\d{2}-\d{2}\.pdf"/);
    expect(pdf.body.slice(0, 5).toString()).toBe("%PDF-");
    expect(sha(pdf.body)).toBe(n.document.sha256);
  });

  test("`?kind=oddiy` — `kind` maydoni yo'q eski qo'lda yozilgan bildirgi ham (2026-09-09 gacha, backfill yo'q)", async () => {
    const at = new Date("2026-08-15T05:00:00Z");
    await Notice.collection.insertOne({
      sender: office[0].user._id,
      program: "ordinatura",
      title: "Eski",
      content: "x",
      status: "yangi",
      deletedAt: null,
      createdAt: at,
      updatedAt: at,
    });
    await Notice.create({ sender: office[0].user._id, program: "ordinatura", title: "Qo'lda", content: "x" });
    const titles = async (q) => (await request(app).get(`/api/notices${q}`).set(as(office[0]))).body.map((d) => d.title).sort();
    expect(await titles("?kind=oddiy")).toEqual(["Eski", "Qo'lda"]);
    expect(await titles("?kind=avtomatik")).toEqual([auto.AUTO_TITLE]);
    const page = await request(app).get("/api/notices/paginate?kind=oddiy&page=1&limit=10").set(as(office[0]));
    expect([page.status, page.body.totalDocs]).toEqual([200, 2]);
  });

  test("PUT va DELETE — 409 auto_notice_readonly (bo'lim ham, ustoz ham); hujjat o'zgarmaydi", async () => {
    const teacher = await userWithRole("klinik_ustoz", ["create", "read", "readAll", "update", "delete"], "self");
    for (const who of [office[0], teacher]) {
      const put = await request(app).put(`/api/notices/${n._id}`).set(as(who)).send({ title: "Boshqa" });
      expect([put.status, put.body.reason]).toEqual([409, "auto_notice_readonly"]);
    }
    const del = await request(app).delete(`/api/notices/${n._id}`).set(as(office[0]));
    expect([del.status, del.body.reason]).toEqual([409, "auto_notice_readonly"]);
    const after = await Notice.findById(n._id).lean();
    expect([after.title, after.deletedAt]).toEqual([n.title, null]);
  });

  test("ko'rish va qaror — 200; tizim qismi tegilmaydi", async () => {
    const view = await request(app).put(`/api/notices/${n._id}/view`).set(as(office[0]));
    expect([view.status, view.body.status]).toEqual([200, "kutilmoqda"]);
    const review = await request(app).put(`/api/notices/${n._id}/review`).set(as(office[0])).send({ decision: "Suhbat o'tkazildi" });
    expect(review.status).toBe(200);
    const after = await Notice.findById(n._id).lean();
    expect(after).toMatchObject({ status: "korib_chiqilgan", decision: "Suhbat o'tkazildi" });
    expect(after.auto).toEqual(n.auto);
  });

  test("rezidentning ustozi ochib-yopdi — `200`, bo'limning `yangi` belgisi qoladi; bo'lim ochdi — `kutilmoqda`", async () => {
    const teacher = await userWithRole("klinik_ustoz", ["create", "read", "readAll", "update", "delete"], "self");
    await Resident.updateOne({ _id: n.resident }, { $set: { supervisor: teacher.user._id } });
    const list = await request(app).get("/api/notices").set(as(teacher));
    expect(list.body.map((d) => d._id)).toEqual([String(n._id)]);
    const peek = await request(app).put(`/api/notices/${n._id}/view`).set(as(teacher));
    expect([peek.status, peek.body.status]).toEqual([200, "yangi"]);
    expect((await Notice.findById(n._id).lean()).status).toBe("yangi");
    const seen = await request(app).put(`/api/notices/${n._id}/view`).set(as(office[0]));
    expect([seen.status, seen.body.status]).toEqual([200, "kutilmoqda"]);
  });

  test("POST `kind: avtomatik` — 400 (mijoz yarata olmaydi)", async () => {
    const teacher = await userWithRole("klinik_ustoz", ["create", "read", "readAll", "update", "delete"], "self");
    const body = { program: "ordinatura", title: "Soxta", content: "x", kind: "avtomatik" };
    const res = await request(app).post("/api/notices").set(as(teacher)).send(body);
    expect([res.status, res.body.detail]).toEqual([400, expect.stringContaining('"kind" must be one of [oddiy, davomat]')]);
    expect(await Notice.countDocuments({ kind: "avtomatik" })).toBe(1);
  });
});

describe("J — bekor qilinganning xabarlari: bir martalik tozalash emas", () => {
  async function announced() {
    const r = await residentWith([2, 2, 2]);
    await runExpulsionSweep();
    const [n] = await autoNotices();
    expect((await alertsOf(n._id)).map((a) => a.active)).toEqual([true, true]);
    return { r, n };
  }

  test("CAS'dan keyingi olish yiqildi — bekor qilingan deb sanaladi, xabarlar o'sha sweep'da olinadi", async () => {
    const { r, n } = await announced();
    const row = await Attendance.findOne({ resident: r._id }).lean();
    await Attendance.updateOne({ _id: row._id }, { $set: { status: "excused" } });
    await Resident.updateOne({ _id: r._id }, { $set: { totalUnexcusedHours: 4 } });
    jest.spyOn(Notification, "updateMany").mockRejectedValueOnce(new Error("transient"));
    await expect(auto.syncAbsenceNotices(new Date())).resolves.toMatchObject({ revoked: 1 });
    expect((await Notice.findById(n._id).lean()).auto.state).toBe("bekor_qilingan");
    expect((await alertsOf(n._id)).map((a) => a.active)).toEqual([false, false]);
  });

  test("jarayon CAS bilan olish orasida o'ldi — keyingi ishga tushish oladi, yil almashgan bo'lsa ham", async () => {
    const { n } = await announced();
    await Notice.updateOne(
      { _id: n._id },
      { $set: { "auto.state": "bekor_qilingan", "auto.revokedAt": new Date(), "auto.hoursAtRevoke": 4 } },
    );
    const nextYear = new Date(WIN.to.getTime() + 10 * DAY);
    await expect(auto.syncAbsenceNotices(nextYear)).resolves.toEqual({ issued: 0, revoked: 0, announced: 0 });
    expect((await alertsOf(n._id)).map((a) => a.active)).toEqual([false, false]);
    expect((await Notice.findById(n._id).lean()).auto).toMatchObject({ state: "bekor_qilingan", hoursAtRevoke: 4 });
  });
});
