"use strict";

jest.mock("#modules/4.05-residency/attendance/attendance.model", () => ({ find: jest.fn() }));
jest.mock("#modules/4.05-residency/resident/resident.model", () => ({ findOne: jest.fn() }));

const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const { unexcusedDateFilter } = require("./unexcusedWindow");
const { RESIDENT_REF_POPULATE } = require("./residentRefPopulate");
const D = require("./expulsionDraftData");

const NOW = new Date("2031-10-20T06:00:00Z");

function chain(result) {
  const calls = {};
  const q = {};
  for (const step of ["select", "populate", "sort"]) {
    q[step] = jest.fn((arg) => {
      calls[step] = arg;
      return q;
    });
  }
  q.lean = jest.fn().mockResolvedValue(result);
  return { q, calls };
}

describe("so'rovlar", () => {
  test("qatorlar: hisob filtri, fan populate'i, sana va `_id` bo'yicha tartib", async () => {
    const { q, calls } = chain([]);
    Attendance.find.mockReturnValueOnce(q);
    await D.loadDraftRows("r1", NOW);
    expect(Attendance.find).toHaveBeenCalledWith({
      resident: "r1",
      status: "absent",
      active: true,
      date: unexcusedDateFilter(NOW),
    });
    expect(calls.select.split(" ").sort()).toEqual(["date", "hours", "lessonType", "science", "scienceTitle"]);
    expect(calls.populate).toEqual({ path: "science", select: "title" });
    expect(calls.sort).toEqual({ date: 1, _id: 1 });
  });

  test("rezident: jonli (soft-delete hook'i bilan `findOne`), shaxsiy maydonlarsiz", async () => {
    const { q, calls } = chain(null);
    Resident.findOne.mockReturnValueOnce(q);
    expect(await D.loadDraftResident("r1")).toBeNull();
    expect(Resident.findOne).toHaveBeenCalledWith({ _id: "r1" });
    expect(calls.populate).toBe(RESIDENT_REF_POPULATE);
    expect(calls.select).not.toMatch(/jshshir|passport|phone|address|user/);
    expect(calls.select.split(" ").sort()).toEqual([
      "active", "courseNumber", "department", "departmentTitle", "expulsionOrderCreated", "expulsionOrderCreatedAt",
      "fullName", "group", "groupTitle", "program", "specialty", "specialtyTitle", "status",
    ]);
  });
});

describe("toDraftInput", () => {
  const order = { _id: { toString: () => "64b0000000000000000000a1" }, residentName: "Aliyev Sardor", countingYear: "2026/2027", draftedAt: new Date("2026-10-14T03:10:00Z"), hoursAtDraft: 72 };
  const resident = {
    fullName: "Aliyev Sardor Botir o‘g‘li",
    program: "ordinatura",
    courseNumber: 2,
    specialty: { title: "Kardiologiya" },
    specialtyTitle: "Eski nom",
    department: null,
    departmentTitle: "Ichki kasalliklar",
    group: { name: "ORD-201" },
    jshshir: "31234567890123",
  };
  const rows = [
    { date: new Date("2026-09-01T19:30:00Z"), science: { title: "Klinik farmakologiya" }, scienceTitle: "eski", lessonType: "amaliy", hours: 4 },
    { date: new Date("2026-09-03T05:00:00Z"), science: null, scienceTitle: "Terapiya", lessonType: null, hours: 0 },
    { date: new Date("2026-09-04T05:00:00Z"), science: null, scienceTitle: null, lessonType: "maruza", hours: null },
  ];

  test("qator soati `hours || 2`, fan jonli → snapshot → `null`, kun UZ bo'yicha", () => {
    const input = D.toDraftInput({ order, resident, rows, total: 8, now: NOW });
    expect(input.rows).toEqual([
      { day: "2026-09-02", science: "Klinik farmakologiya", lessonType: "amaliy", hours: 4 },
      { day: "2026-09-03", science: "Terapiya", lessonType: null, hours: 2 },
      { day: "2026-09-04", science: null, lessonType: "maruza", hours: 2 },
    ]);
    expect(input.rows.reduce((s, r) => s + r.hours, 0)).toBe(input.total);
  });

  test("rezident bloki: jonli nom birinchi, ma'lumotnoma → snapshot; shaxsiy maydon yo'q", () => {
    const input = D.toDraftInput({ order, resident, rows: [], total: 0, now: NOW });
    expect(input).toMatchObject({ orderId: "64b0000000000000000000a1", countingYear: "2026/2027", hoursAtDraft: 72, generatedAt: NOW });
    expect(input.resident).toEqual({
      fullName: "Aliyev Sardor Botir o‘g‘li",
      program: "ordinatura",
      specialty: "Kardiologiya",
      department: "Ichki kasalliklar",
      course: 2,
      group: "ORD-201",
    });
    expect(JSON.stringify(input)).not.toContain("31234567890123");
  });

  test("jonli nom yo'q — buyruqdagi snapshot; hech narsa yo'q — `null`", () => {
    expect(D.toDraftInput({ order, resident: {}, rows: [], total: 0, now: NOW }).resident).toEqual({
      fullName: "Aliyev Sardor", program: null, specialty: null, department: null, course: null, group: null,
    });
    expect(D.titleOf(undefined, undefined)).toBeNull();
  });
});

describe("toRow — bitta jadval qatori", () => {
  test("soat hisob qoidasi bilan (`hours || 2`), kun UZ bo'yicha, fan jonli → snapshot", () => {
    expect(D.toRow({ date: new Date("2026-09-01T19:30:00Z"), science: { title: "Terapiya" }, lessonType: "amaliy", hours: 4 }))
      .toEqual({ day: "2026-09-02", science: "Terapiya", lessonType: "amaliy", hours: 4 });
    expect(D.toRow({ date: new Date("2026-09-03T05:00:00Z"), scienceTitle: "Eski nom", hours: 0 }))
      .toEqual({ day: "2026-09-03", science: "Eski nom", lessonType: null, hours: 2 });
  });

  test("fan ham, snapshot ham yo'q — `null`", () => {
    expect(D.toRow({ date: new Date("2026-09-04T05:00:00Z"), science: null, scienceTitle: null, lessonType: null, hours: null }))
      .toEqual({ day: "2026-09-04", science: null, lessonType: null, hours: 2 });
  });
});
