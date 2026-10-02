jest.mock("#shared/error", () => ({ ErrorHandler: class ErrorHandler extends Error {} }));

const OWNED = ["6a7efdac5916905f06cebeac", "6a7efdac5916905f06cebead"];
let mockOwnedIds = null;
jest.mock("../_services/studentAccess", () => ({
  resolveOwnedGiftedStudentIds: jest.fn(async () => mockOwnedIds),
}));

const mockCalls = { student: [], ach: [], app: [], scholarship: [] };
const emptyAgg = () => Promise.resolve([]);
const chain = (bucket) => ({
  sort: () => chain(bucket),
  limit: () => chain(bucket),
  select: () => chain(bucket),
  lean: () => Promise.resolve([]),
  then: (r) => Promise.resolve([]).then(r),
});

jest.mock("#modules/4.11-giftedStudent/giftedStudent/giftedStudent.model", () => ({
  aggregate: (p) => { mockCalls.student.push(p[0].$match); return emptyAgg(); },
  find: (f) => { mockCalls.student.push(f); return chain("student"); },
}));
jest.mock("#modules/4.11-giftedStudent/studentAchievement/studentAchievement.model", () => ({
  aggregate: (p) => { mockCalls.ach.push(p[0].$match); return emptyAgg(); },
  findOne: (f) => { mockCalls.ach.push(f); return { sort: () => ({ select: () => ({ lean: () => Promise.resolve(null) }) }) }; },
}));
jest.mock("#modules/4.11-giftedStudent/scholarshipApplication/scholarshipApplication.model", () => ({
  aggregate: (p) => { mockCalls.app.push(p[0].$match); return emptyAgg(); },
  find: (f) => { mockCalls.app.push(f); return { select: () => ({ lean: () => Promise.resolve([]) }) }; },
}));
jest.mock("#modules/4.11-giftedStudent/scholarship/scholarship.model", () => ({
  find: (f) => { mockCalls.scholarship.push(f); return { select: () => ({ lean: () => Promise.resolve([]) }) }; },
}));

const Controller = require("./giftedStatistics.controller");

const res = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
const run = async (user) => {
  mockCalls.student = []; mockCalls.ach = []; mockCalls.app = []; mockCalls.scholarship = [];
  const next = jest.fn();
  await Controller.overview({ user }, res(), next);
  if (next.mock.calls.length) throw next.mock.calls[0][0];
};

describe("overview — cheklangan rol (maslahatchi/talaba)", () => {
  beforeEach(() => { mockOwnedIds = OWNED; });

  test("talabalar `_id` bo'yicha cheklanadi", async () => {
    await run({ _id: "u1" });
    for (const m of mockCalls.student) expect(m._id).toEqual({ $in: OWNED });
  });

  test("yutuqlar `student` bo'yicha cheklanadi", async () => {
    await run({ _id: "u1" });
    expect(mockCalls.ach.length).toBeGreaterThan(0);
    for (const m of mockCalls.ach) expect(m.student).toEqual({ $in: OWNED });
  });

  test("arizalar `giftedStudent` bo'yicha cheklanadi", async () => {
    await run({ _id: "u1" });
    expect(mockCalls.app.length).toBeGreaterThan(0);
    for (const m of mockCalls.app) expect(m.giftedStudent).toEqual({ $in: OWNED });
  });

  test("har bir so'rov O'Z maydonini ishlatadi — nom chalkashmaydi", async () => {
    await run({ _id: "u1" });
    for (const m of mockCalls.student) { expect(m.student).toBeUndefined(); expect(m.giftedStudent).toBeUndefined(); }
    for (const m of mockCalls.ach) { expect(m._id).toBeUndefined(); expect(m.giftedStudent).toBeUndefined(); }
    for (const m of mockCalls.app) { expect(m._id).toBeUndefined(); expect(m.student).toBeUndefined(); }
  });

  test("`active: true` filtri SAQLANADI (doira uni ustidan yozmaydi)", async () => {
    await run({ _id: "u1" });
    for (const m of [...mockCalls.student, ...mockCalls.ach, ...mockCalls.app]) expect(m.active).toBe(true);
  });

  test("stipendiya KATALOGI doiralanmaydi — hakamlar soni undan hisoblanadi", async () => {
    await run({ _id: "u1" });
    expect(mockCalls.scholarship.length).toBeGreaterThan(0);
    for (const f of mockCalls.scholarship) {
      expect(f._id).toBeUndefined();
      expect(f.giftedStudent).toBeUndefined();
    }
  });

  test("hech narsaga egalik qilmasa (`[]`) — fail-closed, hammasi emas", async () => {
    mockOwnedIds = [];
    await run({ _id: "u1" });
    for (const m of mockCalls.student) expect(m._id).toEqual({ $in: [] });
  });
});

describe("overview — cheklovsiz rol (ro'yxat egasi / rahbariyat / hakam)", () => {
  beforeEach(() => { mockOwnedIds = null; });

  test("`null` bo'lsa hech qanday id filtri qo'shilmaydi", async () => {
    await run({ _id: "u1" });
    for (const m of mockCalls.student) expect(m._id).toBeUndefined();
    for (const m of mockCalls.ach) expect(m.student).toBeUndefined();
    for (const m of mockCalls.app) expect(m.giftedStudent).toBeUndefined();
  });

  test("`active: true` baribir qo'llanadi", async () => {
    await run({ _id: "u1" });
    for (const m of [...mockCalls.student, ...mockCalls.ach, ...mockCalls.app]) expect(m.active).toBe(true);
  });
});
