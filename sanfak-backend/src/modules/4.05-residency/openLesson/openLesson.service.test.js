"use strict";

const RES_A = "6a5a0acbd34b3c21a575d5f1";
const RES_B = "6a5a0acbd34b3c21a575d5f2";
const U1 = "6a5a0acbd34b3c21a575d601";
const U2 = "6a5a0acbd34b3c21a575d602";
const ROOM = "6a5a0acbd34b3c21a575d701";
const PLAN = "6a5a0acbd34b3c21a575d801";

let mockAllowedIds = null;
let mockResidentExists = true;
let mockRoomDoc = { _id: ROOM, title: "101-xona" };
let mockUserDocs = [];
let mockPlanDoc = null;

const mockLean = (v) => ({ select: () => ({ lean: () => Promise.resolve(v) }) });

jest.mock("#modules/4.05-residency/_services/residentScope", () => ({
  residentIdsFor: () => Promise.resolve(mockAllowedIds),
}));
jest.mock("#modules/4.05-residency/resident/resident.model", () => ({
  exists: () => Promise.resolve(mockResidentExists ? { _id: "x" } : null),
}));
jest.mock("#references/room/room.model", () => ({
  findById: () => mockLean(mockRoomDoc),
}));
jest.mock("#modules/4.01-auth/user/user.model", () => ({
  find: () => ({ select: () => ({ lean: () => Promise.resolve(mockUserDocs) }) }),
}));
jest.mock("#modules/4.05-residency/activityPlan/activityPlan.model", () => ({
  findById: () => mockLean(mockPlanDoc),
}));
jest.mock("#modules/4.05-residency/dissertationPlan/dissertationPlan.model", () => ({
  findById: () => mockLean(mockPlanDoc),
}));

const S = require("./openLesson.service");

beforeEach(() => {
  mockAllowedIds = null;
  mockResidentExists = true;
  mockRoomDoc = { _id: ROOM, title: "101-xona" };
  mockUserDocs = [];
  mockPlanDoc = null;
});

describe("checkResidentScope", () => {
  it("rezidentsiz -> 400", async () => {
    expect(await S.checkResidentScope({}, null)).toMatchObject({ status: 400 });
  });

  it("mavjud bo'lmagan rezident -> 404", async () => {
    mockResidentExists = false;
    expect(await S.checkResidentScope({}, RES_A)).toMatchObject({ status: 404 });
  });

  it("cheklovsiz doira (xodim/global) -> ruxsat", async () => {
    mockAllowedIds = null;
    expect(await S.checkResidentScope({}, RES_A)).toEqual({ ok: true });
  });

  it("o'z rezidenti -> ruxsat", async () => {
    mockAllowedIds = [RES_A];
    expect(await S.checkResidentScope({}, RES_A)).toEqual({ ok: true });
  });

  it("begona rezident -> 403 (404 EMAS: mavjudligi allaqachon ma'lum)", async () => {
    mockAllowedIds = [RES_A];
    const r = await S.checkResidentScope({}, RES_B);
    expect(r).toMatchObject({ ok: false, status: 403 });
    expect(r.message).toContain("huquqi yo'q");
  });

  it("bo'sh doira ([]) hech kimga ruxsat bermaydi", async () => {
    mockAllowedIds = [];
    expect(await S.checkResidentScope({}, RES_A)).toMatchObject({ status: 403 });
  });
});

describe("buildListFilter — doira bosib o'tilmaydi", () => {
  const scope = { resident: { $in: [RES_A] } };

  it("filtrsiz so'rov doirani saqlaydi", () => {
    expect(S.buildListFilter({}, scope)).toEqual(scope);
  });

  it("doiradagi rezident so'ralsa — o'shanga toraytiradi", () => {
    expect(S.buildListFilter({ resident: RES_A }, scope).resident).toBe(RES_A);
  });

  it("doiradan TASHQARIDAGI rezident so'ralsa — hech narsa bermaydi", () => {
    const f = S.buildListFilter({ resident: RES_B }, scope);
    expect(f.resident).toBeNull();
  });

  it("cheklovsiz doirada istalgan rezident so'ralishi mumkin", () => {
    expect(S.buildListFilter({ resident: RES_B }, {}).resident).toBe(RES_B);
  });

  it("tur va sana filtrlari qo'shiladi", () => {
    const f = S.buildListFilter(
      { type: "ochiq_dars", fromDate: "2026-01-01", toDate: "2026-12-31" },
      {},
    );
    expect(f.type).toBe("ochiq_dars");
    expect(f.date.$gte).toBeInstanceOf(Date);
    expect(f.date.$lte).toBeInstanceOf(Date);
  });
});

describe("resolveRoom — auditoriya ma'lumotnomadan", () => {
  it("xona berilmasa ikkalasi ham null", async () => {
    expect(await S.resolveRoom(null)).toEqual({ room: null, roomTitle: null });
  });

  it("nom MA'LUMOTNOMADAN olinadi (mijozdan emas)", async () => {
    const r = await S.resolveRoom(ROOM);
    expect(r.roomTitle).toBe("101-xona");
  });

  it("mavjud bo'lmagan xona -> xato", async () => {
    mockRoomDoc = null;
    expect((await S.resolveRoom(ROOM)).error).toBeDefined();
  });
});

describe("resolveAttendees — o'qituvchilar", () => {
  it("bo'sh ro'yxat", async () => {
    expect(await S.resolveAttendees([])).toEqual({ attendees: [] });
    expect(await S.resolveAttendees(undefined)).toEqual({ attendees: [] });
  });

  it("ism SERVERDA snapshot qilinadi", async () => {
    mockUserDocs = [{ _id: U1, firstName: "Ali", lastName: "Aliyev", middleName: "V" }];
    const r = await S.resolveAttendees([{ user: U1 }]);
    expect(r.attendees).toEqual([{ user: U1, name: "Aliyev Ali V" }]);
  });

  it("mijozning `name` qiymati ISHLATILMAYDI", async () => {
    mockUserDocs = [{ _id: U1, firstName: "Ali", lastName: "Aliyev" }];
    const r = await S.resolveAttendees([{ user: U1, name: "REKTOR" }]);
    expect(r.attendees[0].name).toBe("Aliyev Ali");
  });

  it("takrorlar olib tashlanadi", async () => {
    mockUserDocs = [{ _id: U1, firstName: "Ali", lastName: "Aliyev" }];
    const r = await S.resolveAttendees([{ user: U1 }, { user: U1 }]);
    expect(r.attendees).toHaveLength(1);
  });

  it("kiritilgan tartib saqlanadi", async () => {
    mockUserDocs = [
      { _id: U2, firstName: "Bek", lastName: "Bekov" },
      { _id: U1, firstName: "Ali", lastName: "Aliyev" },
    ];
    const r = await S.resolveAttendees([{ user: U2 }, { user: U1 }]);
    expect(r.attendees.map((a) => a.user)).toEqual([U2, U1]);
  });

  it("mavjud bo'lmagan foydalanuvchi -> xato", async () => {
    mockUserDocs = [];
    expect((await S.resolveAttendees([{ user: U1 }])).error).toBeDefined();
  });

  it("yaroqsiz identifikator -> xato (baza so'rovisiz)", async () => {
    expect((await S.resolveAttendees([{ user: "abc" }])).error).toBeDefined();
  });

  it("ismsiz foydalanuvchi -> name null (bo'sh satr emas)", async () => {
    mockUserDocs = [{ _id: U1 }];
    const r = await S.resolveAttendees([{ user: U1 }]);
    expect(r.attendees[0].name).toBeNull();
  });
});

describe("resolvePlan — reja havolasi", () => {
  it("reja berilmasa uchchovi ham null", async () => {
    expect(await S.resolvePlan(null, null, RES_A)).toEqual({
      plan: null,
      planKind: null,
      planTitle: null,
    });
  });

  it("faqat bittasi berilsa -> xato", async () => {
    expect((await S.resolvePlan("activity", null, RES_A)).error).toBeDefined();
    expect((await S.resolvePlan(null, PLAN, RES_A)).error).toBeDefined();
  });

  it("noma'lum reja turi -> xato", async () => {
    expect((await S.resolvePlan("boshqa", PLAN, RES_A)).error).toBeDefined();
  });

  it("topilmagan reja -> xato", async () => {
    mockPlanDoc = null;
    expect((await S.resolvePlan("activity", PLAN, RES_A)).error).toBeDefined();
  });

  it("BOSHQA rezidentning rejasi -> xato", async () => {
    mockPlanDoc = { _id: PLAN, title: "Begona reja", resident: RES_B };
    const r = await S.resolvePlan("activity", PLAN, RES_A);
    expect(r.error).toBeDefined();
    expect(r.planTitle).toBeUndefined();
  });

  it("o'z rejasi -> nom snapshot qilinadi", async () => {
    mockPlanDoc = { _id: PLAN, title: "Faoliyat rejasi 2026", resident: RES_A };
    const r = await S.resolvePlan("activity", PLAN, RES_A);
    expect(r.planTitle).toBe("Faoliyat rejasi 2026");
    expect(r.planKind).toBe("activity");
  });

  it("populate qilingan `resident` bilan ham ishlaydi", async () => {
    mockPlanDoc = { _id: PLAN, title: "R", resident: { _id: RES_A, fullName: "X" } };
    expect((await S.resolvePlan("dissertation", PLAN, RES_A)).error).toBeUndefined();
  });
});

describe("nameOf", () => {
  it("familiya ism otasining ismi tartibida", () => {
    expect(S.nameOf({ firstName: "Ali", lastName: "Aliyev", middleName: "V" })).toBe(
      "Aliyev Ali V",
    );
  });
  it("bo'sh bo'lsa null", () => {
    expect(S.nameOf({})).toBeNull();
  });
});
