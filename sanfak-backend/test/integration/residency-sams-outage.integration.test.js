"use strict";

const express = require("express");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { handleError } = require("#shared/error");
const UserModel = require("#modules/4.01-auth/user/user.model");
const RoleModel = require("#modules/4.01-auth/role/role.model");
require("#references/department/department.model");
const SamsOrgDay = require("#modules/4.05-residency/samsIngest/samsOrgDay.model");
const Outage = require("#modules/4.05-residency/residencySamsOutage/residencySamsOutage.model");
const { uzDayKey } = require("#modules/4.05-residency/_services/uzDay");
const { addDays } = require("#modules/4.05-residency/samsIngest/samsContract");
const { _idle } = require("#modules/4.05-residency/_services/samsPresenceSync");

const app = express();
app.use(bodyParser.json());
app.use("/api/residency-sams-outages", require("#modules/4.05-residency/residencySamsOutage/residencySamsOutage.routes"));
app.use((err, req, res, next) => handleError(err, res));

const ROOT = "/api/residency-sams-outages";
const today = uzDayKey(new Date());
const D = (n) => addDays(today, n);

async function createUser(title, permissions) {
  const role = await RoleModel.create({ title, permissions, scopeLevel: "global", active: true });
  const user = await UserModel.create({
    firstName: "Test", lastName: title, middleName: "Otaxonovich", role: role._id, active: true,
  });
  return { user, auth: `Bearer ${jwt.sign({ _id: String(user._id) }, process.env.JWT_SECRET)}` };
}

let office;
let reader;
beforeEach(async () => {
  office = await createUser("magistratura_bolim", [
    { section: "residencyLesson", actionKeys: ["update"] },
    { section: "residentAttendance", actionKeys: ["readAll"] },
  ]);
  reader = await createUser("klinik_ustoz", [{ section: "residentAttendance", actionKeys: ["readAll"] }]);
});

const post = (body, who = office) => request(app).post(ROOT).set("Authorization", who.auth).send(body);
const cancel = (id, who = office) =>
  request(app).put(`${ROOT}/${id}/cancel`).set("Authorization", who.auth).send({ reason: "Xato kiritilgan" });
const list = (query, who = office) =>
  request(app).get(`${ROOT}/paginate`).query({ page: 1, limit: 20, ...query }).set("Authorization", who.auth);
const seedOrgDay = (dbname, day, orgTitle) =>
  SamsOrgDay.create({ dbname, day, orgTitle, measured: true, packetAt: new Date(), receivedAt: new Date() });
const body = (over = {}) => ({ from: D(-3), to: D(-1), dbname: null, reason: "Turniket ishlamadi", ...over });

describe("yaratish", () => {
  afterEach(() => _idle());
  it("bo'lim → 201 DTO (barcha klinikalar, yaratuvchi F.I.Sh bilan)", async () => {
    const res = await post(body());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      from: D(-3), to: D(-1), dbname: null, orgTitle: null, reason: "Turniket ishlamadi",
      cancelledAt: null, cancelledBy: null, cancelReason: null,
      createdBy: { firstName: "Test", lastName: "magistratura_bolim", middleName: "Otaxonovich" },
    });
    expect(Object.keys(res.body).sort()).toEqual([
      "_id", "cancelReason", "cancelledAt", "cancelledBy", "createdAt", "createdBy", "dbname", "from", "orgTitle", "reason", "to",
    ]);
  });

  it("noma'lum klinika → 400 unknown_clinic; orgDay paydo bo'lgach → 201, nom snapshot'i (eng so'nggi kun)", async () => {
    const bad = await post(body({ dbname: "clinicA" }));
    expect([bad.status, bad.body.reason]).toEqual([400, "unknown_clinic"]);
    await seedOrgDay("clinicA", D(-5), "Eski nom");
    await seedOrgDay("clinicA", D(-1), "Yangi nom");
    const ok = await post(body({ dbname: "clinicA" }));
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ dbname: "clinicA", orgTitle: "Yangi nom" });
  });

  it.each([
    ["from > to", { from: D(-1), to: D(-3) }],
    ["kelajak (to > bugun)", { from: D(-1), to: D(1) }],
    ["367 kun", { from: D(-366), to: D(0) }],
  ])("%s → 400 outage_range_invalid", async (_l, over) => {
    const res = await post(body(over));
    expect([res.status, res.body.reason]).toEqual([400, "outage_range_invalid"]);
    expect(await Outage.countDocuments()).toBe(0);
  });

  it("faqat readAll — POST 403, GET 200", async () => {
    expect((await post(body(), reader)).status).toBe(403);
    expect((await list({}, reader)).status).toBe(200);
  });
});

describe("bekor qilish va ro'yxat", () => {
  afterEach(() => _idle());
  it("bekor qilish → 200 (kim, qachon, sabab); ikkinchi marta → 409; noma'lum id → 404", async () => {
    const { body: created } = await post(body());
    const res = await cancel(created._id);
    expect(res.status).toBe(200);
    expect(res.body.cancelReason).toBe("Xato kiritilgan");
    expect(res.body.cancelledAt).not.toBeNull();
    expect(res.body.cancelledBy).toMatchObject({ lastName: "magistratura_bolim", middleName: "Otaxonovich" });
    const again = await cancel(created._id);
    expect([again.status, again.body.reason]).toEqual([409, "already_cancelled"]);
    const missing = await cancel("507f1f77bcf86cd799439011");
    expect([missing.status, missing.body.reason]).toEqual([404, "outage_not_found"]);
    expect((await cancel(created._id, reader)).status).toBe(403);
  });

  it("ro'yxat: standart — faqat faol; status=all/cancelled; from/to kesishish; saralash from ↓", async () => {
    const a = (await post(body({ from: D(-10), to: D(-8) }))).body;
    const b = (await post(body({ from: D(-5), to: D(-4) }))).body;
    const c = (await post(body({ from: D(-2), to: D(-2) }))).body;
    await cancel(b._id);

    const active = await list({});
    expect(active.body.docs.map((d) => d._id)).toEqual([c._id, a._id]);
    expect(active.body.totalDocs).toBe(2);
    expect((await list({ status: "all" })).body.docs.map((d) => d._id)).toEqual([c._id, b._id, a._id]);
    expect((await list({ status: "cancelled" })).body.docs.map((d) => d._id)).toEqual([b._id]);
    const overlap = await list({ status: "all", from: D(-8), to: D(-5) });
    expect(overlap.body.docs.map((d) => d._id)).toEqual([b._id, a._id]);
    expect(overlap.body.docs[1].createdBy).toMatchObject({ firstName: "Test", middleName: "Otaxonovich" });
  });

  it("`page`/`limit` majburiy, noma'lum parametr → 400", async () => {
    const res = await request(app).get(`${ROOT}/paginate`).set("Authorization", office.auth);
    expect(res.status).toBe(400);
    expect((await list({ includeCancelled: true })).status).toBe(400);
  });
});
