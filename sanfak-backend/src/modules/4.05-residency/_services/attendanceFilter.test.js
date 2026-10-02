"use strict";

const MINE = "1111111111111111aaaaaaaa";
const DEAD = "2222222222222222bbbbbbbb";
const USTOZ = "3333333333333333cccccccc";
const SCIENCE = "5555555555555555eeeeeeee";

jest.mock("#modules/4.05-residency/resident/resident.model", () => {
  const { ObjectId } = require("mongodb");
  return {
    find: jest.fn((q) => ({
      select: () => ({
        lean: jest.fn(async () => {
          if (q.academicYear || q.course || q.academicYearRef || q.courseRef)
            return global.__byAttr__ || [];
          if (q.supervisor && String(q.supervisor) === "3333333333333333cccccccc")
            return [{ _id: new ObjectId("1111111111111111aaaaaaaa") }];
          return [];
        }),
      }),
    })),
    findDeleted: jest.fn(() => ({
      select: () => ({ lean: jest.fn(async () => global.__deleted__ || []) }),
    })),
  };
});

const { buildAttendanceFilter } = require("./attendanceFilter");
const { ObjectId } = require("mongodb");

const setDeleted = (ids) => {
  global.__deleted__ = ids.map((id) => ({ _id: new ObjectId(id) }));
};
const setByAttr = (ids) => {
  global.__byAttr__ = ids.map((id) => ({ _id: new ObjectId(id) }));
};

const globalUser = { _id: "x", role: { scopeLevel: "global", title: "rektor" } };
const ustoz = { _id: USTOZ, role: { scopeLevel: "department", title: "klinik_ustoz" } };

beforeEach(() => {
  setDeleted([]);
  setByAttr([]);
});

describe("buildAttendanceFilter — ko'rish doirasi (MD-19)", () => {
  it("global rol: o'chirilgan rezident YO'Q bo'lsa filtr bo'sh", async () => {
    const { filter, denied } = await buildAttendanceFilter(globalUser, {});
    expect(denied).toBe(false);
    expect(filter).toEqual({});
  });

  it("global rol: o'chirilgan rezident `$nin` bilan CHIQARILADI", async () => {
    setDeleted([DEAD]);
    const { filter } = await buildAttendanceFilter(globalUser, {});
    expect(filter.resident.$nin.map(String)).toEqual([DEAD]);
  });

  it("cheklangan rol: ro'yxat `$in` va u ALLAQACHON tiriklardan iborat", async () => {
    const { filter } = await buildAttendanceFilter(ustoz, {});
    expect(filter.resident.$in.map(String)).toEqual([MINE]);
  });

  it("o'chirilgan rezident ANIQ so'ralsa — global rolda ham RAD etiladi", async () => {
    setDeleted([DEAD]);
    const { denied } = await buildAttendanceFilter(globalUser, { resident: DEAD });
    expect(denied).toBe(true);
  });

  it("tirik rezident aniq so'ralsa — o'tadi", async () => {
    setDeleted([DEAD]);
    const { filter, denied } = await buildAttendanceFilter(globalUser, { resident: MINE });
    expect(denied).toBe(false);
    expect(String(filter.resident)).toBe(MINE);
  });
});

describe("buildAttendanceFilter — atribut filtri bilan kesishma", () => {
  it("global (`$nin`) + o'quv yili → `$in` ga aylanadi, BO'SH EMAS", async () => {
    setDeleted([DEAD]);
    setByAttr([MINE, DEAD]);
    const { filter, denied } = await buildAttendanceFilter(globalUser, {
      academicYear: "2025/2026",
    });
    expect(denied).toBe(false);
    expect(filter.resident.$in.map(String)).toEqual([MINE]);
  });

  it("kesishma BO'SH bo'lsa — denied (bo'sh sahifa)", async () => {
    setDeleted([MINE]);
    setByAttr([MINE]);
    const { denied } = await buildAttendanceFilter(globalUser, { academicYear: "2025/2026" });
    expect(denied).toBe(true);
  });
});

describe("buildAttendanceFilter — oddiy maydonlar", () => {
  it("status/science/lessonType/group to'g'ridan-to'g'ri o'tadi", async () => {
    const { filter } = await buildAttendanceFilter(globalUser, {
      status: "present",
      science: SCIENCE,
      lessonType: "amaliy",
      group: "6666666666666666ffffffff",
    });
    expect(filter).toMatchObject({
      status: "present",
      science: SCIENCE,
      lessonType: "amaliy",
      group: "6666666666666666ffffffff",
    });
  });

  it("`date` — bir kunlik oraliq (`$gte`/`$lt`)", async () => {
    const { filter } = await buildAttendanceFilter(globalUser, { date: "2026-03-04" });
    expect(filter.date.$gte).toEqual(new Date("2026-03-04"));
    expect(filter.date.$lt.getTime() - filter.date.$gte.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("`startDate`+`endDate` — yopiq oraliq (`$gte`/`$lte`)", async () => {
    const { filter } = await buildAttendanceFilter(globalUser, {
      startDate: "2026-01-01",
      endDate: "2026-02-01",
    });
    expect(filter.date).toEqual({
      $gte: new Date("2026-01-01"),
      $lte: new Date("2026-02-01"),
    });
  });

  it("`date` berilsa `startDate`/`endDate` E'TIBORGA OLINMAYDI (bir kun ustun)", async () => {
    const { filter } = await buildAttendanceFilter(globalUser, {
      date: "2026-03-04",
      startDate: "2026-01-01",
      endDate: "2026-02-01",
    });
    expect(filter.date.$lt).toBeDefined();
    expect(filter.date.$lte).toBeUndefined();
  });

  it("`page`/`limit` filtrga TUSHMAYDI (ular sahifalash parametri)", async () => {
    const { filter } = await buildAttendanceFilter(globalUser, { page: 3, limit: 50 });
    expect(filter.page).toBeUndefined();
    expect(filter.limit).toBeUndefined();
  });
});
