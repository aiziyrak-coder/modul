"use strict";

const os = require("os");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const FILES_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "p6a3-draft-"));
process.env.RESIDENCY_EXPULSION_ORDER_FILES_DIR = FILES_DIR;

const express = require("express");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { handleError } = require("#shared/error");
const UserModel = require("#modules/4.01-auth/user/user.model");
const RoleModel = require("#modules/4.01-auth/role/role.model");
require("#references/department/department.model");
const Science = require("#references/science/science.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const Order = require("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model");
const files = require("#modules/4.05-residency/_services/expulsionOrderFiles");
const { openDraft } = require("#modules/4.05-residency/_services/expulsionOrderLifecycle");
const { countUnexcusedHours, runExpulsionCheck } = require("#modules/4.05-residency/_services/expulsionCheck");
const { currentAcademicYearWindow, currentAcademicYearTitle } = require("#modules/4.05-residency/_services/unexcusedWindow");

const app = express();
app.use(bodyParser.json());
app.use("/api/expulsion-orders", require("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.routes"));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => handleError(err, res));

const ROOT = "/api/expulsion-orders";
const DAY = 24 * 3600 * 1000;
const SCAN = Buffer.concat([Buffer.from("%PDF-1.7"), Buffer.alloc(512, 0x20)]);
const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const today = () => new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
const tick = () => new Promise((r) => setTimeout(r, 30));
const walk = (dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]))
    : [];
const draftFiles = () => walk(path.join(FILES_DIR, "draft"));
const allFiles = () => walk(FILES_DIR);

async function createUser(title) {
  const role = await RoleModel.create({
    title,
    permissions: [{ section: "resident", actionKeys: ["changeStatus", "read", "readAll"] }],
    scopeLevel: "global",
    active: true,
  });
  const user = await UserModel.create({ firstName: "Test", lastName: title, role: role._id, active: true });
  return { user, auth: `Bearer ${jwt.sign({ _id: String(user._id) }, process.env.JWT_SECRET)}` };
}

let office;
let admin;
let science;

async function residentWith72() {
  const r = await Resident.create({ program: "ordinatura", fullName: "Valiyev Ali Karimovich", courseNumber: 1 });
  const from = new Date(currentAcademicYearWindow().from);
  await Attendance.insertMany(
    Array.from({ length: 9 }, (_, i) => ({
      resident: r._id,
      date: new Date(from.getTime() + (40 + i) * DAY),
      status: "absent",
      hours: 8,
      active: true,
      science: science._id,
      lessonType: "amaliy",
    })),
  );
  return r;
}

const announce = (orderId) => Order.updateOne({ _id: orderId }, { $set: { noticesSentAt: new Date() } });

async function draft() {
  const r = await residentWith72();
  const { orderId } = await openDraft({ residentId: r._id, residentName: "Valiyev Ali", source: "cron", countHours: countUnexcusedHours });
  await announce(orderId);
  return { r, id: String(orderId) };
}

const binary = (req) =>
  req.buffer(true).parse((res, cb) => {
    const chunks = [];
    res.on("data", (c) => chunks.push(c));
    res.on("end", () => cb(null, Buffer.concat(chunks)));
  });
const getPdf = (id, who = office) => binary(request(app).get(`${ROOT}/${id}/draft-pdf`).set("Authorization", who.auth));
const startPdf = (id) => getPdf(id).then((res) => res);
const json = (res) => JSON.parse(Buffer.isBuffer(res.body) ? res.body.toString("utf8") : JSON.stringify(res.body));
const reasonOf = (res) => json(res).reason;
const uploadScan = (id) => request(app).put(`${ROOT}/${id}/scan`).set("Authorization", office.auth).attach("file", SCAN, "buyruq.pdf");
const sign = (id) =>
  request(app)
    .put(`${ROOT}/${id}/sign`)
    .set("Authorization", office.auth)
    .send({ orderId: id, paperOrderNumber: "12-ch", paperOrderDate: today(), scanSha256: sha(SCAN) });
const stored = (id) => Order.findById(id).lean();

function holdSave() {
  const real = files.save;
  let release;
  let reached;
  const gate = new Promise((r) => {
    release = r;
  });
  const arrived = new Promise((r) => {
    reached = r;
  });
  jest.spyOn(files, "save").mockImplementationOnce(async (...args) => {
    const saved = await real(...args);
    reached();
    await gate;
    return saved;
  });
  return { arrived, release };
}

beforeAll(() => Order.init());
beforeEach(async () => {
  office = await createUser("magistratura_bolim");
  admin = await createUser("super_admin");
  science = await Science.create({ title: "Ichki kasalliklar propedevtikasi" });
  fs.rmSync(FILES_DIR, { recursive: true, force: true });
  fs.mkdirSync(FILES_DIR, { recursive: true });
});
afterEach(() => jest.restoreAllMocks());
afterAll(() => fs.rmSync(FILES_DIR, { recursive: true, force: true }));

describe("birinchi yuklab olish yaratadi, keyingilari o'sha faylni beradi", () => {
  test("200, aniq sarlavhalar, sha256 hujjatdagi bilan teng, bitta fayl `draft/` da", async () => {
    const { r, id } = await draft();
    const res = await getPdf(id);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/octet-stream");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["cache-control"]).toBe("private, no-store");
    expect(res.headers["content-disposition"]).toMatch(
      new RegExp(`^attachment; filename="chetlatish-buyrugi-loyihasi-${id.slice(-6)}-\\d{2}\\.\\d{2}\\.\\d{4}\\.pdf"`),
    );
    expect(res.body.subarray(0, 5).toString()).toBe("%PDF-");
    const order = await stored(id);
    expect(sha(res.body)).toBe(order.draftPdf.sha256);
    expect(order.draftPdf).toMatchObject({ hours: 72, templateVersion: 1, generatedBy: office.user._id });
    expect(order.history.map((h) => h.action)).toEqual(["yaratildi", "pdf_yaratildi"]);
    expect(draftFiles()).toHaveLength(1);
    expect(order.draftPdf.hours).toBe(await countUnexcusedHours(r._id));
  });

  test("qayta so'rov — o'sha bayt, fayl ko'paymaydi, metama'lumot o'zgarmaydi", async () => {
    const { r, id } = await draft();
    const first = await getPdf(id);
    const before = (await stored(id)).draftPdf;
    await Attendance.create({ resident: r._id, date: new Date(), status: "absent", hours: 2, active: true });
    const second = await getPdf(id);
    expect(second.status).toBe(200);
    expect(second.body.equals(first.body)).toBe(true);
    expect((await stored(id)).draftPdf).toEqual(before);
    expect(draftFiles()).toHaveLength(1);
  });

  test("jadval = hisob: sababli, nofaol, o'chirilgan, o'tgan yil yozuvlari tushmaydi; 0/null — 2 soat", async () => {
    const r = await residentWith72();
    const inWindow = new Date(new Date(currentAcademicYearWindow().from).getTime() + 60 * DAY);
    const beforeWindow = new Date(new Date(currentAcademicYearWindow().from).getTime() - 10 * DAY);
    await Attendance.insertMany([
      { resident: r._id, date: inWindow, lessonType: "maruza", status: "excused", hours: 8, active: true },
      { resident: r._id, date: inWindow, lessonType: "amaliy", status: "absent", hours: 8, active: false },
      { resident: r._id, date: inWindow, status: "absent", hours: 8, active: true, deletedAt: new Date() },
      { resident: r._id, date: beforeWindow, status: "absent", hours: 8, active: true },
      { resident: r._id, date: inWindow, lessonType: "oraliq_nazorat", status: "absent", hours: 0, active: true },
      { resident: r._id, date: inWindow, lessonType: "yakuniy_nazorat", status: "absent", hours: null, active: true },
    ]);
    const { orderId } = await openDraft({ residentId: r._id, residentName: "V", source: "cron", countHours: countUnexcusedHours });
    await announce(orderId);
    expect((await getPdf(String(orderId))).status).toBe(200);
    const hours = (await stored(orderId)).draftPdf.hours;
    expect(hours).toBe(76);
    expect(hours).toBe(await countUnexcusedHours(r._id));
  });

  test("keyin skan + imzo — 200; imzolangan buyruqda PDF dalil bo'lib qoladi va beriladi", async () => {
    const { id } = await draft();
    const first = await getPdf(id);
    expect((await uploadScan(id)).status).toBe(200);
    expect((await sign(id)).status).toBe(200);
    const order = await stored(id);
    expect(order.status).toBe("imzolangan");
    const again = await getPdf(id);
    expect(again.body.equals(first.body)).toBe(true);
    const dto = await request(app).get(`${ROOT}/${id}`).set("Authorization", office.auth);
    expect(dto.body).toMatchObject({ canGetDraftPdf: true, draftPdf: { sha256: order.draftPdf.sha256, hours: 72 } });
    expect(JSON.stringify(dto.body)).not.toContain("storageKey");
  });
});

describe("rad etishlar — diskda hech narsa, `draftPdf` bo'sh", () => {
  test.each([
    ["super_admin (W-4=A)", 403, "not_office_signer", async () => ({ who: admin })],
    ["`meros` (W-3=A)", 409, "draft_pdf_not_available", async (id) => Order.collection.updateOne({ _id: Order.castObject({ _id: id })._id }, { $set: { origin: "meros" } })],
    ["yopilgan buyruq", 404, "draft_pdf_missing", async (id) => Order.updateOne({ _id: id }, { $set: { status: "bekor_qilingan" } })],
    ["qoldirishlar sababli qilindi (baholashsiz)", 409, "hours_below_threshold", async (id, r) => Attendance.updateMany({ resident: r._id }, { $set: { status: "excused" } })],
    ["rezident ta'tilda", 409, "resident_not_signable", async (id, r) => Resident.collection.updateOne({ _id: r._id }, { $set: { status: "akademik_tatil" } })],
    ["o'tgan o'quv yili", 409, "draft_year_closed", async (id) => Order.updateOne({ _id: id }, { $set: { countingYear: "2000/2001" } })],
    ["hali e'lon qilinmagan", 409, "draft_not_ready", async (id) => Order.updateOne({ _id: id }, { $set: { noticesSentAt: null } })],
    ["ko'rsatkich tozalangan", 409, "draft_not_ready", async (id, r) => Resident.collection.updateOne({ _id: r._id }, { $set: { expulsionOrderCreated: false } })],
  ])("%s → %i %s", async (_label, code, reason, arrange) => {
    const { r, id } = await draft();
    const who = (await arrange(id, r))?.who ?? office;
    const res = await getPdf(id, who);
    expect(res.status).toBe(code);
    expect(reasonOf(res)).toBe(reason);
    expect(draftFiles()).toHaveLength(0);
    expect((await stored(id)).draftPdf).toBeNull();
  });

  test("skan avval yuklangan — 409 `scan_already_uploaded`", async () => {
    const { id } = await draft();
    await uploadScan(id);
    const res = await getPdf(id);
    expect(res.status).toBe(409);
    expect(reasonOf(res)).toBe("scan_already_uploaded");
    expect(draftFiles()).toHaveLength(0);
  });

  test("HEAD — 405, hech narsa yaratilmaydi", async () => {
    const { id } = await draft();
    const res = await request(app).head(`${ROOT}/${id}/draft-pdf`).set("Authorization", office.auth);
    expect(res.status).toBe(405);
    expect(res.headers.allow).toBe("GET");
    expect(draftFiles()).toHaveLength(0);
    expect((await stored(id)).draftPdf).toBeNull();
  });

  test("rezident o'chirilgan — saqlangan PDF ham berilmaydi (404)", async () => {
    const { r, id } = await draft();
    expect((await getPdf(id)).status).toBe(200);
    await Resident.collection.updateOne({ _id: r._id }, { $set: { deletedAt: new Date() } });
    expect((await getPdf(id)).status).toBe(404);
  });
});

describe("saqlangan fayl — sha256 tekshiruvi sarlavhalardan OLDIN", () => {
  test("fayl o'chirilgan — 404 JSON; bitta bayt qo'shilgan — 500 `draft_pdf_integrity`", async () => {
    const { id } = await draft();
    await getPdf(id);
    const [file] = draftFiles();
    fs.appendFileSync(file, "x");
    const tampered = await getPdf(id);
    expect(tampered.status).toBe(500);
    expect(reasonOf(tampered)).toBe("draft_pdf_integrity");
    expect(tampered.headers["content-disposition"]).toBeUndefined();
    fs.unlinkSync(file);
    const missing = await getPdf(id);
    expect(missing.status).toBe(404);
    expect(missing.headers["content-type"]).toMatch(/application\/json/);
    expect(reasonOf(missing)).toBe("draft_pdf_file_missing");
    expect(draftFiles()).toHaveLength(0);
  });
});

describe("poygalar (darvoza bilan)", () => {
  test("R1 — ikki GET: ikkalasi 200 va bir xil bayt, bitta fayl (g'olibniki)", async () => {
    const { id } = await draft();
    const hold = holdSave();
    const a = startPdf(id);
    await hold.arrived;
    const b = await getPdf(id);
    expect(b.status).toBe(200);
    hold.release();
    const resA = await a;
    expect(resA.status).toBe(200);
    expect(resA.body.equals(b.body)).toBe(true);
    const files_ = draftFiles();
    expect(files_).toHaveLength(1);
    expect(files_[0].replace(/\\/g, "/")).toContain((await stored(id)).draftPdf.storageKey);
  });

  test.each([
    ["R2 — imzo", async (id) => {
      await uploadScan(id);
      expect((await sign(id)).status).toBe(200);
    }, "order_not_open"],
    ["R3 — rad etish", async (id) => {
      const res = await request(app).put(`${ROOT}/${id}/reject`).set("Authorization", office.auth).send({ orderId: id, reason: "Sababli" });
      expect(res.status).toBe(200);
    }, "order_not_open"],
    ["R4 — T2 bekor qilish (ariza tasdig'i)", async (id, r) => {
      await Attendance.updateMany({ resident: r._id }, { $set: { status: "excused" } });
      await runExpulsionCheck(r._id, { source: "application" });
      expect((await stored(id)).status).toBe("bekor_qilingan");
    }, "order_not_open"],
    ["R5 — skan yuklandi (W-5=C)", async (id) => {
      expect((await uploadScan(id)).status).toBe(200);
    }, "scan_already_uploaded"],
  ])("%s GET ushlanganda yutdi — GET 409, loyiha fayli qolmaydi", async (_label, winner, reason) => {
    const { r, id } = await draft();
    const hold = holdSave();
    const pending = startPdf(id);
    await hold.arrived;
    await winner(id, r);
    hold.release();
    const res = await pending;
    expect(res.status).toBe(409);
    expect(reasonOf(res)).toBe(reason);
    expect(draftFiles()).toHaveLength(0);
    expect((await stored(id)).draftPdf).toBeNull();
  });

  test("R5' — GET avval yutdi, keyin skan: ikkalasi 200, hujjatda ikkalasi", async () => {
    const { id } = await draft();
    expect((await getPdf(id)).status).toBe(200);
    expect((await uploadScan(id)).status).toBe(200);
    const order = await stored(id);
    expect(order.draftPdf).not.toBeNull();
    expect(order.scan.sha256).toBe(sha(SCAN));
    expect(allFiles()).toHaveLength(2);
  });

  test("R6 — CAS xato berdi: 500, fayl QOLADI; keyingi GET 200 va o'z faylini beradi", async () => {
    const { id } = await draft();
    jest.spyOn(Order, "findOneAndUpdate").mockImplementationOnce(() => ({
      lean: async () => {
        throw new Error("socket closed");
      },
    }));
    const res = await getPdf(id);
    expect(res.status).toBe(500);
    expect(draftFiles()).toHaveLength(1);
    expect((await stored(id)).draftPdf).toBeNull();
    const next = await getPdf(id);
    expect(next.status).toBe(200);
    expect(draftFiles()).toHaveLength(2);
    expect(sha(next.body)).toBe((await stored(id)).draftPdf.sha256);
  });

  test("R7 — ochuvchi hujjatdan keyin, ko'rsatkichdan oldin: 409 `draft_not_ready`, keyin 200", async () => {
    const r = await residentWith72();
    let release;
    const gate = new Promise((res) => {
      release = res;
    });
    let calls = 0;
    const countHours = async (id) => {
      calls += 1;
      if (calls === 2) await gate;
      return countUnexcusedHours(id);
    };
    const opening = openDraft({ residentId: r._id, residentName: "V", source: "cron", countHours });
    let order = null;
    while (!order) {
      await tick();
      order = await Order.findOne({ resident: r._id, status: "loyiha" }).lean();
    }
    const early = await getPdf(String(order._id));
    expect(early.status).toBe(409);
    expect(reasonOf(early)).toBe("draft_not_ready");
    release();
    await opening;
    expect(reasonOf(await getPdf(String(order._id)))).toBe("draft_not_ready");
    await announce(order._id);
    expect((await getPdf(String(order._id))).status).toBe(200);
    expect(order.countingYear).toBe(currentAcademicYearTitle());
  });

  test("R8 — E11000 ko'rsatkichi e'lon emas: GET 409, ochuvchi rad etsa hujjat qaytariladi", async () => {
    const r = await residentWith72();
    let release;
    const gate = new Promise((res) => {
      release = res;
    });
    let calls = 0;
    const countA = async () => {
      calls += 1;
      if (calls === 2) {
        await gate;
        return 64;
      }
      return 72;
    };
    const opening = openDraft({ residentId: r._id, residentName: "V", source: "cron", countHours: countA });
    let order = null;
    while (!order) {
      await tick();
      order = await Order.findOne({ resident: r._id, status: "loyiha" }).lean();
    }
    const b = await openDraft({ residentId: r._id, residentName: "V", source: "attendance", countHours: async () => 72 });
    expect(b).toMatchObject({ opened: false, reason: "already_open" });
    expect((await Resident.collection.findOne({ _id: r._id })).expulsionOrderCreatedAt).toEqual(order.draftedAt);
    const res = await getPdf(String(order._id));
    expect(res.status).toBe(409);
    expect(reasonOf(res)).toBe("draft_not_ready");
    release();
    expect(await opening).toMatchObject({ opened: false, reason: "below_threshold" });
    expect(await Order.countDocuments({ resident: r._id })).toBe(0);
    expect(draftFiles()).toHaveLength(0);
  });
});
