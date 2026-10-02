"use strict";

const Resident = require("#modules/4.05-residency/resident/resident.model");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const Order = require("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model");
const Notification = require("#system/notification/notification.model");
const NotificationPreference = require("#system/notification/notificationPreference.model");
const RoleModel = require("#modules/4.01-auth/role/role.model");
const UserModel = require("#modules/4.01-auth/user/user.model");
const {
  markSignedBasisLost,
} = require("#modules/4.05-residency/_services/expulsionOrderDecision");
const {
  countUnexcusedHours,
  runExpulsionSweep,
} = require("#modules/4.05-residency/_services/expulsionCheck");
const {
  currentAcademicYearWindow,
} = require("#modules/4.05-residency/_services/unexcusedWindow");
const {
  _recountUnexcused,
} = require("#modules/4.05-residency/residentApplication/residentApplication.controller");

const YM = (() => {
  const d = new Date(currentAcademicYearWindow().from);
  d.setUTCMonth(d.getUTCMonth() + 2);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
})();
const HOUR = 3600 * 1000;
const U7 = "residency_expulsion_basis_lost_office";

let office;
beforeAll(() => Order.init());
beforeEach(async () => {
  const role = await RoleModel.create({ title: "magistratura_bolim", scopeLevel: "global", active: true });
  office = await Promise.all(
    ["A", "B"].map((n) => UserModel.create({ firstName: n, lastName: "Bolim", role: role._id, active: true })),
  );
});

async function expelledWith(hours, order = {}) {
  const user = await UserModel.create({ firstName: "Ali", lastName: "Valiyev", active: true });
  const r = await Resident.create({
    program: "ordinatura",
    fullName: "Valiyev Ali",
    courseNumber: 1,
    status: "chetlatilgan",
    user: user._id,
  });
  if (hours) {
    await Attendance.create({ resident: r._id, date: new Date(`${YM}-03`), status: "absent", hours, active: true });
  }
  const o = await Order.create({
    resident: r._id,
    residentName: "Valiyev Ali",
    origin: "tizim",
    status: "imzolangan",
    countingYear: "2026/2027",
    draftedAt: new Date(Date.now() - 48 * HOUR),
    signedAt: new Date(Date.now() - 24 * HOUR),
    hoursAtSign: 76,
    paperOrderNumber: "12-ch",
    paperOrderDate: "2026-10-01",
    residentAppliedAt: new Date(Date.now() - 24 * HOUR),
    deliveries: { signed: new Date() },
    ...order,
  });
  return { r, o, user };
}
const u7Count = () => Notification.countDocuments({ eventType: U7 });

describe("G9 — U-7=B: imzodan keyin soat 72 dan tushdi", () => {
  test("uch parallel da'vogar — BITTA tarix yozuvi", async () => {
    const { r, o } = await expelledWith(20);
    const claims = await Promise.all(
      ["cron", "attendance", "application"].map((source) =>
        markSignedBasisLost({ residentId: r._id, source, countHours: countUnexcusedHours }),
      ),
    );
    expect(claims.filter(Boolean)).toHaveLength(1);
    const doc = await Order.findById(o._id).lean();
    expect(doc.history.filter((h) => h.action === "asos_72_dan_past")).toHaveLength(1);
    expect(doc).toMatchObject({ status: "imzolangan", hoursAtBasisLost: 20 });
    expect((await Resident.collection.findOne({ _id: r._id })).status).toBe("chetlatilgan");
  });

  test.each([
    ["imzo O'TGAN o'quv yilida (1-sentabr nollanishi)", { signedAt: new Date(currentAcademicYearWindow().from.getTime() - HOUR) }],
    ["72 dan past imzolangan `meros`", { origin: "meros", hoursAtSign: 40 }],
  ])("%s — da'vo YO'Q", async (_label, order) => {
    const { r } = await expelledWith(20, order);
    expect(await markSignedBasisLost({ residentId: r._id, source: "cron", countHours: countUnexcusedHours })).toBeNull();
  });

  test("sweep: da'vo + bo'limning har xodimiga BITTA ilova ichi xabari; ikkinchi sweep — takror yo'q", async () => {
    const { o } = await expelledWith(20);
    await runExpulsionSweep();
    await runExpulsionSweep();
    const saved = await Notification.find({ eventType: U7 }).lean();
    expect(saved.map((n) => String(n.user)).sort()).toEqual(office.map((u) => String(u._id)).sort());
    expect(saved.every((n) => n.channels.join() === "inApp")).toBe(true);
    expect(saved.map((n) => n.link)).toEqual(saved.map(() => `/residency/chetlatish-buyruqlari/${o._id}`));
  });

  test("ariza tasdig'i (qayta hisob) ham da'voga yetadi", async () => {
    const { r, o } = await expelledWith(20);
    await _recountUnexcused(r._id);
    await new Promise((x) => setTimeout(x, 100));
    expect((await Order.findById(o._id).lean()).basisLostAt).toBeInstanceOf(Date);
    expect(await u7Count()).toBe(2);
  });
});

describe("G9 — yetkazish uzilgan qaror xabarlari qayta e'lon qilinadi", () => {
  test("U-7: da'vo bor, xabar yo'q (jarayon o'ldirilgan) — bitta sweep bitta xabar", async () => {
    const at = new Date(Date.now() - HOUR);
    await expelledWith(90, { basisLostAt: at, hoursAtBasisLost: 20 });
    await NotificationPreference.create({
      user: office[0]._id,
      preferences: { [U7]: { inApp: false, telegram: true } },
    });
    await runExpulsionSweep();
    await runExpulsionSweep();
    expect(await u7Count()).toBe(2);
  });

  test("U-6: S2 bajarilgan-u xabar yo'q — rezidentga bitta xabar, belgi", async () => {
    const { o, user } = await expelledWith(90, { deliveries: { signed: null } });
    await runExpulsionSweep();
    await runExpulsionSweep();
    const saved = await Notification.find({ eventType: "residency_expulsion_signed" }).lean();
    expect(saved).toHaveLength(1);
    expect(saved[0].active).toBe(true);
    expect(String(saved[0].user)).toBe(String(user._id));
    expect(saved[0].metadata).toEqual({ residentId: String(o.resident), orderId: String(o._id) });
    expect((await Order.findById(o._id).lean()).deliveries.signed).toBeInstanceOf(Date);
  });

  test("V-5: rad etilgan loyiha — rezidentga bitta xabar", async () => {
    const { o } = await expelledWith(0, {
      status: "rad_etilgan",
      closedAt: new Date(Date.now() - HOUR),
      hoursAtClose: 74,
      deliveries: {},
    });
    await Resident.updateOne({ _id: o.resident }, { $set: { status: "oquvda" } });
    await runExpulsionSweep();
    await runExpulsionSweep();
    expect(await Notification.countDocuments({ eventType: "residency_expulsion_rejected" })).toBe(1);
  });
});
