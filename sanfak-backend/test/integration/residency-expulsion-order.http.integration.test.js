"use strict";

const os = require("os");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const FILES_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "p6a2-http-"));
process.env.RESIDENCY_EXPULSION_ORDER_FILES_DIR = FILES_DIR;
process.env.RESIDENCY_EXPULSION_SCAN_MAX_MB = "1";

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
const Order = require("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model");
const Notification = require("#system/notification/notification.model");
const { openDraft } = require("#modules/4.05-residency/_services/expulsionOrderLifecycle");
const { countUnexcusedHours } = require("#modules/4.05-residency/_services/expulsionCheck");
const { currentAcademicYearWindow } = require("#modules/4.05-residency/_services/unexcusedWindow");

const app = express();
app.use(bodyParser.json());
app.use("/api/expulsion-orders", require("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.routes"));
app.use("/api/residents", require("#modules/4.05-residency/resident/resident.routes"));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => handleError(err, res));

const ROOT = "/api/expulsion-orders";
const pad = (head, size = 512) => Buffer.concat([Buffer.from(head), Buffer.alloc(size, 0x20)]);
const PDF = pad([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
const JPG = pad([0xff, 0xd8, 0xff, 0xe0]);
const PNG = pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const GIF = pad([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const today = () => new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
const blobs = (dir = FILES_DIR) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? blobs(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );

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
async function draft() {
  const account = await UserModel.create({ firstName: "Ali", lastName: "Valiyev", active: true });
  const r = await Resident.create({ program: "ordinatura", fullName: "Valiyev Ali", courseNumber: 1, user: account._id });
  const from = new Date(currentAcademicYearWindow().from);
  await Attendance.insertMany(
    Array.from({ length: 9 }, (_, i) => ({
      resident: r._id,
      date: new Date(from.getTime() + (40 + i) * 24 * 3600 * 1000),
      status: "absent",
      hours: 8,
      active: true,
    })),
  );
  const { orderId } = await openDraft({ residentId: r._id, residentName: "Valiyev Ali", source: "cron", countHours: countUnexcusedHours });
  return { r, id: String(orderId), account };
}
const upload = (id, buf, name = "buyruq.pdf", who = office, field = "file") =>
  request(app).put(`${ROOT}/${id}/scan`).set("Authorization", who.auth).attach(field, buf, name);
const signBody = (id, extra = {}) => ({ orderId: id, paperOrderNumber: "12-ch", paperOrderDate: today(), scanSha256: sha(PDF), ...extra });
const sign = (id, body = signBody(id), who = office) =>
  request(app).put(`${ROOT}/${id}/sign`).set("Authorization", who.auth).send(body);

beforeAll(() => Order.init());
beforeEach(async () => {
  office = await createUser("magistratura_bolim");
  admin = await createUser("super_admin");
  fs.rmSync(FILES_DIR, { recursive: true, force: true });
  fs.mkdirSync(FILES_DIR, { recursive: true });
});
afterAll(() => fs.rmSync(FILES_DIR, { recursive: true, force: true }));

describe("skan — faqat PDF/JPG/PNG, `uploads/` dan tashqarida", () => {
  test.each([
    ["PDF", PDF, "b.pdf", "application/pdf"],
    ["JPG", JPG, "b.jpg", "image/jpeg"],
    ["PNG", PNG, "b.png", "image/png"],
  ])("%s → 200, sha256 va tur baytdan", async (_label, buf, name, mimeType) => {
    const { id } = await draft();
    const res = await upload(id, buf, name);
    expect(res.status).toBe(200);
    expect(res.body.scan).toMatchObject({ sha256: sha(buf), mimeType, fileName: name, size: buf.length });
    expect(JSON.stringify(res.body)).not.toContain("storageKey");
    expect(blobs()).toHaveLength(1);
    expect(fs.existsSync(path.resolve("uploads/residency-expulsion-orders"))).toBe(false);
  });

  test.each([
    ["`.png` deb nomlangan GIF", GIF, "b.png", "file", "SCAN_TYPE_NOT_ALLOWED"],
    ["noto'g'ri maydon", PDF, "b.pdf", "files", "SCAN_FIELD_UNEXPECTED"],
    ["1 MB dan katta", pad([0x25, 0x50, 0x44, 0x46, 0x2d], 1.2 * 1024 * 1024), "b.pdf", "file", "SCAN_TOO_LARGE"],
  ])("%s → 400, diskda hech narsa", async (_label, buf, name, field, reason) => {
    const { id } = await draft();
    const res = await upload(id, buf, name, office, field);
    expect(res.status).toBe(400);
    expect(res.body.reason).toBe(reason);
    expect(blobs()).toHaveLength(0);
  });

  test("loyiha emas — 409, diskka YOZILMAYDI", async () => {
    const { id } = await draft();
    await Order.updateOne({ _id: id }, { $set: { status: "bekor_qilingan" } });
    const res = await upload(id, PDF);
    expect(res.status).toBe(409);
    expect(blobs()).toHaveLength(0);
  });

  test("yuklab olish: aniq sarlavhalar, baytlar o'sha", async () => {
    const { id } = await draft();
    await upload(id, PDF, "Buyruq №12.pdf");
    const res = await request(app)
      .get(`${ROOT}/${id}/scan`)
      .set("Authorization", office.auth)
      .buffer(true)
      .parse((r, cb) => {
        const chunks = [];
        r.on("data", (c) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/octet-stream");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["cache-control"]).toBe("private, no-store");
    expect(res.headers["content-disposition"]).toBe(
      `attachment; filename="Buyruq _12.pdf"; filename*=UTF-8''${encodeURIComponent("Buyruq №12.pdf")}`,
    );
    expect(Buffer.compare(res.body, PDF)).toBe(0);
  });
});

describe("U-2=A — super_admin ko'radi, qaror qila olmaydi", () => {
  test("GET — 200 (bayroqlar false); skan, imzo, yuklab olish — 403", async () => {
    const { id } = await draft();
    const seen = await request(app).get(`${ROOT}/${id}`).set("Authorization", admin.auth);
    expect(seen.status).toBe(200);
    expect(seen.body).toMatchObject({ canSign: false, canReject: false, canUploadScan: false });
    for (const res of [
      await upload(id, PDF, "b.pdf", admin),
      await sign(id, signBody(id), admin),
      await request(app).get(`${ROOT}/${id}/scan`).set("Authorization", admin.auth),
    ]) {
      expect(res.status).toBe(403);
      expect(res.body.reason).toBe("not_office_signer");
    }
    expect(blobs()).toHaveLength(0);
  });
});

describe("ko'rik (P6a-2) — chegaralar", () => {
  test("super_admin imzo — tana tekshiruvidan OLDIN 403 (smoke tekshiruvi)", async () => {
    const { id } = await draft();
    const res = await sign(id, {}, admin);
    expect(res.status).toBe(403);
  });

  test("fayl bilan matn maydoni — 400 `SCAN_FIELD_UNEXPECTED`", async () => {
    const { id } = await draft();
    const res = await request(app)
      .put(`${ROOT}/${id}/scan`)
      .set("Authorization", office.auth)
      .field("note", "x")
      .attach("file", PDF, "b.pdf");
    expect(res.status).toBe(400);
    expect(res.body.reason).toBe("SCAN_FIELD_UNEXPECTED");
    expect(blobs()).toHaveLength(0);
  });

  test("yuklab olishda kengaytma baytdan (`.bat` → `.pdf`)", async () => {
    const { id } = await draft();
    const res = await upload(id, PDF, "buyruq-12.bat");
    expect(res.body.scan.fileName).toBe("buyruq-12.pdf");
  });
});

describe("ro'yxat", () => {
  test("o'chirilgan rezidentniki chiqmaydi; `storageKey`/`eriSubject` hech qachon", async () => {
    const a = await draft();
    const b = await draft();
    await upload(a.id, PDF);
    await Resident.collection.updateOne({ _id: b.r._id }, { $set: { deletedAt: new Date() } });
    const res = await request(app).get(`${ROOT}/paginate?page=1&limit=10`).set("Authorization", office.auth);
    expect(res.status).toBe(200);
    expect(res.body.docs.map((d) => d._id)).toEqual([a.id]);
    expect(res.body.docs[0].resident).toMatchObject({ fullName: "Valiyev Ali" });
    expect(JSON.stringify(res.body)).not.toMatch(/storageKey|eriSubject|deliveries/);
  });
});

describe("imzo tanasi — ERI baytlari", () => {
  test.each([
    ["`eriData`", { eriData: "REFUQQ==" }, undefined],
    ["`eriKey`", { eriKey: "k" }, undefined],
    ["bo'shliqli raqam", { paperOrderNumber: " 12" }, undefined],
    ["boshqa `orderId`", { orderId: "64b0000000000000000000ff" }, "binding_mismatch"],
    ["placeholder imzo", { eriSignature: "TEMP_ERI_PLACEHOLDER" }, undefined],
  ])("%s → 400", async (_label, patch, reason) => {
    const { id } = await draft();
    await upload(id, PDF);
    const res = await sign(id, signBody(id, patch));
    expect(res.status).toBe(400);
    if (reason) expect(res.body.reason).toBe(reason);
    expect((await Order.findById(id).lean()).status).toBe("loyiha");
  });
});

describe("to'liq qaror", () => {
  test("imzo → `imzolangan`, rezident `chetlatilgan`, rezidentga BITTA ilova ichi xabari", async () => {
    const { r, id, account } = await draft();
    await upload(id, PDF);
    const res = await sign(id);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "imzolangan", paperOrderNumber: "12-ch", needsResume: false });
    expect(res.body.signedBy).toMatchObject({ lastName: "magistratura_bolim" });
    expect((await Resident.collection.findOne({ _id: r._id })).status).toBe("chetlatilgan");
    const notices = await Notification.find({ eventType: "residency_expulsion_signed" }).lean();
    expect(notices.map((n) => String(n.user))).toEqual([String(account._id)]);
    expect((await sign(id)).status).toBe(200);
    expect(await Notification.countDocuments({ eventType: "residency_expulsion_signed" })).toBe(1);
  });

  test("rad etish → `rad_etilgan`, sabab `closeNote` da, rezidentga sababsiz xabar", async () => {
    const { r, id } = await draft();
    const res = await request(app)
      .put(`${ROOT}/${id}/reject`)
      .set("Authorization", office.auth)
      .send({ orderId: id, reason: "Ariza sababli deb topildi" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "rad_etilgan", closeNote: "Ariza sababli deb topildi", hoursAtClose: 72 });
    expect((await Resident.collection.findOne({ _id: r._id })).expulsionOrderCreated).toBe(false);
    const [notice] = await Notification.find({ eventType: "residency_expulsion_rejected" }).lean();
    expect(JSON.stringify(notice)).not.toContain("sababli deb topildi");
  });

  test("U-4: ochiq loyiha bor — ta'til PATCH 409, javobda `reason` va `orderId`", async () => {
    const { r, id } = await draft();
    const res = await request(app)
      .patch(`/api/residents/${r._id}/status`)
      .set("Authorization", office.auth)
      .send({ status: "akademik_tatil", reason: "Sog'liq sababli" });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ reason: "expulsion_order_open", orderId: id });
  });
});
