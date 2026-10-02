"use strict";

const MINE = "1111111111111111aaaaaaaa";
const FOREIGN = "2222222222222222bbbbbbbb";
const USTOZ = "3333333333333333cccccccc";
const TALABA = "4444444444444444dddddddd";

jest.mock("#modules/4.05-residency/resident/resident.model", () => {
  const { ObjectId } = require("mongodb");
  return {
    find: jest.fn((q) => ({
      select: () => ({
        lean: jest.fn(async () => {
          const sup = q.supervisor ? String(q.supervisor) : null;
          const usr = q.user ? String(q.user) : null;
          if (sup === "3333333333333333cccccccc")
            return [{ _id: new ObjectId("1111111111111111aaaaaaaa") }];
          if (usr === "4444444444444444dddddddd")
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

const setDeleted = (ids) => {
  const { ObjectId } = require("mongodb");
  global.__deleted__ = ids.map((id) => ({ _id: new ObjectId(id) }));
};
beforeEach(() => setDeleted([]));

const { buildResidentScope, allowedResidentIds } = require("./residentScope");

const user = (title, scopeLevel, _id) => ({ _id, role: { title, scopeLevel } });

describe("allowedResidentIds", () => {
  it("magistratura_bolim → null (cheklovsiz)", async () => {
    await expect(allowedResidentIds(user("magistratura_bolim", "self", "x"))).resolves.toBeNull();
  });
  it("scopeLevel=global → null (cheklovsiz)", async () => {
    await expect(allowedResidentIds(user("rektor", "global", "x"))).resolves.toBeNull();
  });
  it("klinik_ustoz → biriktirilgan talabalar ro'yxati", async () => {
    const ids = await allowedResidentIds(user("klinik_ustoz", "department", USTOZ));
    expect(ids.map(String)).toEqual([MINE]);
  });
  it("kafedra_mudiri kundalikda hech narsa ko'rmaydi (4.5 dizayni — dailyLog roli yo'q)", async () => {
    const ids = await allowedResidentIds(user("kafedra_mudiri", "department", "boshqa"));
    expect(ids).toEqual([]);
  });
});

describe("buildResidentScope — aniq bir yozuv so'ralganda", () => {
  it("cheklovsiz rol istalgan yozuvga kira oladi", async () => {
    const r = await buildResidentScope(user("magistratura_bolim", "self", "x"), FOREIGN);
    expect(r.denied).toBe(false);
  });

  it("ustoz O'ZIGA biriktirilgan talaba yozuviga kiradi", async () => {
    const r = await buildResidentScope(user("klinik_ustoz", "department", USTOZ), MINE);
    expect(r.denied).toBe(false);
  });

  it("D6 REGRESSIYA: ustoz BEGONA talaba yozuviga kira OLMAYDI", async () => {
    const r = await buildResidentScope(user("klinik_ustoz", "department", USTOZ), FOREIGN);
    expect(r.denied).toBe(true);
  });

  it("D6 REGRESSIYA: talaba BEGONA yozuvga kira OLMAYDI", async () => {
    const r = await buildResidentScope(user("rezident", "self", TALABA), FOREIGN);
    expect(r.denied).toBe(true);
  });

  it("talaba O'Z yozuviga kiradi", async () => {
    const r = await buildResidentScope(user("rezident", "self", TALABA), MINE);
    expect(r.denied).toBe(false);
  });

  it("D6 REGRESSIYA: kafedra_mudiri BEGONA kundalikni tasdiqlay OLMAYDI", async () => {
    const r = await buildResidentScope(user("kafedra_mudiri", "department", "boshqa"), FOREIGN);
    expect(r.denied).toBe(true);
  });
});

describe("buildResidentScope — ro'yxat (aniq yozuv so'ralmagan)", () => {
  it("cheklovsiz rolda filtr bo'sh", async () => {
    const r = await buildResidentScope(user("rektor", "global", "x"));
    expect(r).toEqual({ filter: {}, denied: false });
  });

  it("cheklangan rolda filtr $in bilan cheklanadi", async () => {
    const r = await buildResidentScope(user("klinik_ustoz", "department", USTOZ));
    expect(r.denied).toBe(false);
    expect(r.filter.resident.$in.map(String)).toEqual([MINE]);
  });

  it("hech narsa biriktirilmagan rolda filtr BO'SH ro'yxat (hammasi emas!)", async () => {
    const r = await buildResidentScope(user("kafedra_mudiri", "department", "boshqa"));
    expect(r.filter.resident.$in).toEqual([]);
  });
});
