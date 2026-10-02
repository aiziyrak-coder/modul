"use strict";

const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const ResidentApplication = require("#modules/4.05-residency/residentApplication/residentApplication.model");
const {
  approvedExcuseQuery,
  excusePatch,
  coveringExcuse,
  applyApprovedExcuses,
} = require("./approvedExcuses");

const d = (s) => new Date(`${s}T00:00:00.000Z`);
const app = (id, from, to, extra = {}) => ({ _id: id, reason: "Kasal", reviewedBy: "u1", fromDate: d(from), toDate: d(to), ...extra });

afterEach(() => jest.restoreAllMocks());

describe("so'rov va yamoq", () => {
  test("so'rov — tasdiqlangan, ikkala sana ham bor, rezidentlar ro'yxati", () => {
    expect(approvedExcuseQuery(["r1", "r2"])).toEqual({
      resident: { $in: ["r1", "r2"] },
      status: "tasdiqlangan",
      fromDate: { $ne: null },
      toDate: { $ne: null },
    });
  });

  test("yamoq — eski `applyApprovedExcuses` literali bilan AYNAN bir xil (kalit tartibi ham)", () => {
    const a = app("a1", "2026-10-01", "2026-10-03");
    const legacy = {
      status: "excused",
      excuseReason: a.reason || "Ariza asosida",
      excuseApprovedBy: a.reviewedBy,
      fromDate: a.fromDate,
      toDate: a.toDate,
      application: a._id,
    };
    expect(excusePatch(a)).toEqual(legacy);
    expect(Object.keys(excusePatch(a))).toEqual(Object.keys(legacy));
  });

  test("sababsiz ariza — «Ariza asosida»", () => {
    expect(excusePatch(app("a1", "2026-10-01", "2026-10-01", { reason: "" })).excuseReason).toBe("Ariza asosida");
  });
});

describe("coveringExcuse — qaysi ariza qoplaydi", () => {
  const apps = [app("early", "2026-10-01", "2026-10-05"), app("late", "2026-10-03", "2026-10-10")];

  test.each([
    ["boshlanish chegarasi (kiradi)", "2026-10-01", "early"],
    ["tugash chegarasi (kiradi)", "2026-10-05", "early"],
    ["kesishma — eng erta yaratilgan yutadi", "2026-10-04", "early"],
    ["faqat keyingisi qoplaydi", "2026-10-07", "late"],
    ["oraliqdan oldin", "2026-09-30", null],
    ["oraliqdan keyin", "2026-10-11", null],
  ])("%s", (_label, day, expected) => {
    expect(coveringExcuse(apps, d(day))?._id ?? null).toBe(expected);
  });

  test("bo'sh ro'yxat, `null` ro'yxat va yaroqsiz sana — hech biri qoplamaydi", () => {
    expect(coveringExcuse([], d("2026-10-02"))).toBeNull();
    expect(coveringExcuse(null, d("2026-10-02"))).toBeNull();
    expect(coveringExcuse(apps, null)).toBeNull();
    expect(coveringExcuse([app("x", "2026-10-01", "2026-10-02", { toDate: null })], d("2026-10-01"))).toBeNull();
  });
});

describe("applyApprovedExcuses — ko'chirilgan xulq", () => {
  test("arizalar `createdAt` bo'yicha, har biriga `absent` qatorlar `updateMany` bilan", async () => {
    const approved = [app("a1", "2026-10-01", "2026-10-02"), app("a2", "2026-10-05", "2026-10-06")];
    const chain = { select: jest.fn(() => chain), sort: jest.fn().mockResolvedValue(approved) };
    jest.spyOn(ResidentApplication, "find").mockReturnValue(chain);
    const update = jest.spyOn(Attendance, "updateMany").mockResolvedValue({ modifiedCount: 1 });

    await applyApprovedExcuses("r1");

    expect(ResidentApplication.find).toHaveBeenCalledWith(approvedExcuseQuery(["r1"]));
    expect(chain.select).toHaveBeenCalledWith("reason fromDate toDate reviewedBy");
    expect(chain.sort).toHaveBeenCalledWith({ createdAt: 1 });
    expect(update).toHaveBeenCalledTimes(2);
    expect(update.mock.calls[0]).toEqual([
      { resident: "r1", status: "absent", active: true, date: { $gte: approved[0].fromDate, $lte: approved[0].toDate } },
      excusePatch(approved[0]),
    ]);
    expect(update.mock.calls[1][1].application).toBe("a2");
  });
});
