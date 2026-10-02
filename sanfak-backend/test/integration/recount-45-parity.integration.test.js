"use strict";

const Resident = require("#modules/4.05-residency/resident/resident.model");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const Order = require("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model");
const {
  currentAcademicYearWindow,
} = require("#modules/4.05-residency/_services/unexcusedWindow");
const { countUnexcusedHours } = require("#modules/4.05-residency/_services/expulsionCheck");
const { compare, applySweep } = require("../../scripts/recount-45-unexcused-hours");

const YM = (() => {
  const d = new Date(currentAcademicYearWindow().from);
  d.setUTCMonth(d.getUTCMonth() + 2);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
})();

const seed = async (name, fields, hours72) => {
  const { insertedId } = await Resident.collection.insertOne({
    program: "ordinatura",
    fullName: name,
    status: "oquvda",
    active: true,
    deletedAt: null,
    expulsionOrderCreated: false,
    totalUnexcusedHours: 0,
    ...fields,
  });
  if (hours72) {
    await Attendance.insertMany(
      Array.from({ length: 9 }, (_, i) => ({
        resident: insertedId,
        date: new Date(`${YM}-${String(i + 1).padStart(2, "0")}`),
        status: "absent",
        hours: 8,
        active: true,
      })),
    );
  }
  return insertedId;
};

const T0 = new Date("2026-09-20T08:00:00Z");
const T1 = new Date("2026-09-21T08:00:00Z");
const openOrder = (resident, origin, draftedAt = T0) =>
  Order.create({ resident, origin, status: "loyiha", countingYear: "2026/2027", draftedAt });
const decided = (resident, status, fields = {}) =>
  Order.create({ resident, origin: "tizim", status, countingYear: "2026/2027", draftedAt: T0, ...fields });
const IN_YEAR = new Date(new Date(currentAcademicYearWindow().from).getTime() + 30 * 24 * 3600 * 1000);
const LAST_YEAR = new Date(new Date(currentAcademicYearWindow().from).getTime() - 24 * 3600 * 1000);
const pointed = { expulsionOrderCreated: true, expulsionOrderCreatedAt: T0 };
const softDeleteLastLesson = async (resident) => {
  const day = (d) => new Date(`${YM}-${d}`);
  await Attendance.collection.updateOne(
    { resident, date: day("09") },
    { $set: { deletedAt: T0, deletionReason: "p9_duplicate_lesson:test" } },
  );
  await Attendance.collection.updateOne({ resident, date: day("01") }, { $unset: { deletedAt: "" } });
};

beforeEach(() => Order.init());

test("dry-run prognozi sweep'ning HAQIQIY natijasiga teng", async () => {
  const ids = {
    open: await seed("Ochiladi", {}, true),
    legacyFlag: await seed("EskiBayroq", { expulsionOrderCreated: true }, true),
    alreadyOpen: await seed("Ochiq", { expulsionOrderCreated: true }, true),
    cancelTizim: await seed("YopiladiT", pointed, false),
    staleTizim: await seed("Eskirgan", pointed, false),
    orphanTizim: await seed("Yetim", {}, false),
    cancelLegacy: await seed("YopiladiL", { expulsionOrderCreated: true }, false),
    merosKept: await seed("Meros", pointed, false),
    inactive: await seed("Nofaol", { active: false }, true),
    leave: await seed("Tatil", { status: "akademik_tatil" }, true),
    expelled: await seed("Chetlatilgan", { status: "chetlatilgan", expulsionOrderCreated: true }, false),
    wmBlocked: await seed("Chiziq", {}, true),
    wmStale: await seed("ChiziqBayroq", pointed, true),
    wmLastYear: await seed("OtganYil", {}, true),
    halfSigned: await seed("YarimImzo", pointed, true),
    halfSignedLow: await seed("YarimImzoPast", pointed, false),
    wmTwo: await seed("IkkiRad", {}, true),
    softOpen: await seed("SoftOchilmaydi", {}, true),
    softCancel: await seed("SoftYopiladi", pointed, true),
  };
  await softDeleteLastLesson(ids.softOpen);
  await softDeleteLastLesson(ids.softCancel);
  await openOrder(ids.softCancel, "tizim");
  await decided(ids.wmTwo, "rad_etilgan", { closedAt: IN_YEAR, hoursAtClose: 70 });
  await decided(ids.wmTwo, "rad_etilgan", { closedAt: new Date(IN_YEAR.getTime() + 3600e3), hoursAtClose: 80 });
  await decided(ids.wmBlocked, "rad_etilgan", { closedAt: IN_YEAR, hoursAtClose: 72 });
  await decided(ids.wmStale, "rad_etilgan", { closedAt: IN_YEAR, hoursAtClose: 72 });
  await decided(ids.wmLastYear, "rad_etilgan", { closedAt: LAST_YEAR, hoursAtClose: 90 });
  await decided(ids.halfSigned, "imzolangan", { signedAt: T0 });
  await decided(ids.halfSignedLow, "imzolangan", { signedAt: T0 });
  await openOrder(ids.cancelTizim, "tizim");
  await openOrder(ids.staleTizim, "tizim", T1);
  await openOrder(ids.orphanTizim, "tizim", T1);
  await openOrder(ids.alreadyOpen, "tizim");
  await openOrder(ids.merosKept, "meros");

  const { drafts, rows } = await compare();
  const predicted = Object.fromEntries(
    Object.entries(drafts).map(([k, list]) => [k, list.map((d) => d.id).sort()]),
  );

  expect(await applySweep()).toBe(true);

  const byAction = async (action) =>
    (await Order.find({ "history.0.action": action }).lean()).map((o) => String(o.resident)).sort();
  const flagCleared = (
    await Resident.collection
      .find({
        _id: {
          $in: [
            ids.cancelTizim, ids.staleTizim, ids.orphanTizim, ids.cancelLegacy, ids.merosKept, ids.expelled,
            ids.wmStale, ids.halfSigned, ids.halfSignedLow, ids.softCancel,
          ],
        },
        expulsionOrderCreated: false,
      })
      .toArray()
  ).map((r) => String(r._id)).sort();

  expect(predicted.open).toEqual(await byAction("yaratildi"));
  expect(predicted.cancel).toEqual(flagCleared);
  expect(predicted).toEqual({
    open: [ids.open, ids.legacyFlag, ids.wmLastYear].map(String).sort(),
    cancel: [ids.cancelTizim, ids.staleTizim, ids.orphanTizim, ids.cancelLegacy, ids.wmStale, ids.softCancel]
      .map(String).sort(),
  });
  for (const id of [ids.softOpen, ids.softCancel]) {
    const row = rows.find((x) => x.id === String(id));
    expect(row).toMatchObject({ currentYear: 64, allHistory: 64 });
    expect(row.currentYear).toBe(await countUnexcusedHours(id));
  }
  expect((await Order.findOne({ resident: ids.softCancel }).lean()).status).toBe("bekor_qilingan");
  expect(await Order.countDocuments({ resident: { $in: [ids.halfSigned, ids.halfSignedLow, ids.wmBlocked, ids.wmTwo] }, status: "loyiha" })).toBe(0);
  expect((await Order.findOne({ resident: ids.cancelTizim }).lean()).status).toBe("bekor_qilingan");
  expect((await Order.findOne({ resident: ids.merosKept }).lean()).status).toBe("loyiha");
  expect((await Order.findOne({ resident: ids.staleTizim }).lean()).status).toBe("bekor_qilingan");
  expect((await Order.findOne({ resident: ids.orphanTizim }).lean()).status).toBe("bekor_qilingan");
});
