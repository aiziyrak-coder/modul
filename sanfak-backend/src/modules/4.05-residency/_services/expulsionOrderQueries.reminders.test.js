"use strict";

jest.mock("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model");

const Order = require("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model");
const { dueReminderStage, findDueReminders } = require("./expulsionOrderQueries");

const DAY = 24 * 3600 * 1000;
const CREATED = new Date("2031-10-01T03:00:00Z");
const at = (days, hour = 3) => new Date(CREATED.getTime() + days * DAY + (hour - 3) * 3600 * 1000);

describe("dueReminderStage — bosqich faqat 3, 7, 14, 21, 28-kunda o'zgaradi", () => {
  const expected = (d) => (d < 3 ? 0 : d < 7 ? 1 : 1 + Math.floor(d / 7));
  it.each(Array.from({ length: 31 }, (_, d) => [d, expected(d)]))("%i-kun → %i", (d, stage) => {
    expect(dueReminderStage(CREATED, at(d))).toBe(stage);
  });

  it("chegaralar va yaroqsiz qiymatlar", () => {
    expect([2, 3, 6, 7, 13, 14, 20, 21].map((d) => dueReminderStage(CREATED, at(d)))).toEqual([0, 1, 1, 2, 2, 3, 3, 4]);
    expect(dueReminderStage(null, at(10))).toBe(0);
    expect(dueReminderStage(at(5), CREATED)).toBe(0);
  });
});

describe("findDueReminders", () => {
  let calls;
  const withRows = (rows) => {
    calls = {};
    Order.find = jest.fn((filter) => {
      calls.filter = filter;
      const q = { select: (s) => { calls.select = s; return q; }, lean: jest.fn().mockResolvedValue(rows) };
      return q;
    });
  };
  const row = (extra = {}) => ({ _id: "o1", resident: "r1", origin: "tizim", createdAt: CREATED, noticesSentAt: CREATED, remindedStage: null, ...extra });

  it("so'rov: ochiq, `meros` yoki e'lon qilingan `tizim`; kerakli maydonlar", async () => {
    withRows([]);
    await findDueReminders(at(3));
    expect(calls.filter).toEqual({ status: "loyiha", $or: [{ origin: "meros" }, { noticesSentAt: { $ne: null } }] });
    expect(calls.select.split(" ").sort()).toEqual(
      ["_id", "createdAt", "noticesSentAt", "origin", "remindedStage", "resident", "residentName"].sort(),
    );
  });

  it("allaqachon yuborilgan bosqich tushadi; o'tkazib yuborilgan kunlar — BITTA eng yuqori bosqich", async () => {
    withRows([row({ _id: "a", remindedStage: 1 }), row({ _id: "b", remindedStage: 2 }), row({ _id: "c" })]);
    const due = await findDueReminders(at(8));
    expect(due.map((d) => [d.order._id, d.stage, d.days])).toEqual([["a", 2, 8], ["c", 2, 8]]);
    withRows([row()]);
    expect((await findDueReminders(at(20))).map((d) => d.stage)).toEqual([3]);
  });

  it("0-kun xabari BUGUN ketgan (kechikkan e'lon) — shu kuni eslatma yo'q, ertasiga bor", async () => {
    withRows([row({ noticesSentAt: at(5, 4) })]);
    expect(await findDueReminders(at(5, 6))).toEqual([]);
    withRows([row({ noticesSentAt: at(5, 4) })]);
    expect((await findDueReminders(at(6))).map((d) => [d.stage, d.days])).toEqual([[1, 6]]);
  });

  it("`meros` — e'lonsiz ham, 3-kundan", async () => {
    withRows([row({ origin: "meros", noticesSentAt: null })]);
    expect(await findDueReminders(at(2))).toEqual([]);
    withRows([row({ origin: "meros", noticesSentAt: null })]);
    expect((await findDueReminders(at(3))).map((d) => d.stage)).toEqual([1]);
  });
});
