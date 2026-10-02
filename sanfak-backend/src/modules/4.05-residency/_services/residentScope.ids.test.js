"use strict";

const mockLean = jest.fn();
const mockFind = jest.fn(() => ({ select: () => ({ lean: mockLean }) }));

jest.mock("#modules/4.05-residency/resident/resident.model", () => ({
  find: mockFind,
  findById: jest.fn(),
  findOne: jest.fn(),
}));

const { residentIdsFor, allowedResidentIds } = require("./residentScope");

const ME = "6a5a0acbd34b3c21a575d59d";
const DEPT = "6a5a0acbd34b3c21a575daaa";
const IDS = ["6a5a0acbd34b3c21a575dccc"];

const user = (title, scopeLevel, extra = {}) => ({
  _id: ME,
  role: { title, scopeLevel },
  ...extra,
});

beforeEach(() => {
  mockFind.mockClear();
  mockLean.mockClear();
  mockLean.mockResolvedValue(IDS.map((_id) => ({ _id })));
});

describe("cheklovsiz (`null`) — DB ga umuman bormaydi", () => {
  it.each([
    ["super_admin", "global"],
    ["admin", "global"],
    ["rektor", "global"],
    ["magistratura_bolim", "global"],
  ])("%s -> null", async (title, scopeLevel) => {
    await expect(residentIdsFor(user(title, scopeLevel))).resolves.toBeNull();
    expect(mockFind).not.toHaveBeenCalled();
  });

  it("magistratura_bolim `department` bo'lsa ham cheklovsiz", async () => {
    await expect(residentIdsFor(user("magistratura_bolim", "department"))).resolves.toBeNull();
  });
});

describe("kafedra mudiri — kafedra bo'yicha", () => {
  it("o'z kafedrasidagi rezidentlar", async () => {
    await expect(
      residentIdsFor(user("kafedra_mudiri", "department", { department: DEPT })),
    ).resolves.toEqual(IDS);
    expect(mockFind).toHaveBeenCalledWith({ department: DEPT });
  });

  it("kafedrasi yo'q -> bo'sh ro'yxat, DB so'rovi yo'q", async () => {
    await expect(residentIdsFor(user("kafedra_mudiri", "department"))).resolves.toEqual([]);
    expect(mockFind).not.toHaveBeenCalled();
  });
});

describe("ustoz / ilmiy rahbar — biriktirilganlar", () => {
  it.each(["klinik_ustoz", "ilmiy_rahbar"])("%s -> supervisor bo'yicha", async (title) => {
    await expect(residentIdsFor(user(title, "department"))).resolves.toEqual(IDS);
    expect(mockFind).toHaveBeenCalledWith({ supervisor: ME });
  });
});

describe("talaba (self) — faqat o'zi", () => {
  it.each(["rezident", "magistrant"])("%s -> user bo'yicha", async (title) => {
    await expect(residentIdsFor(user(title, "self"))).resolves.toEqual(IDS);
    expect(mockFind).toHaveBeenCalledWith({ user: ME });
  });

  it("noma'lum rol -> eng tor shox (fail-closed)", async () => {
    await residentIdsFor({ _id: ME });
    expect(mockFind).toHaveBeenCalledWith({ user: ME });
  });
});

describe("`allowedResidentIds` = `residentIdsFor` — D-34 dan keyin", () => {
  it("kafedra mudiri IKKALA yo'lda ham kafedra bo'yicha ko'radi", async () => {
    const u = user("kafedra_mudiri", "department", { department: DEPT });

    await allowedResidentIds(u);
    expect(mockFind).toHaveBeenLastCalledWith({ department: DEPT });

    await residentIdsFor(u);
    expect(mockFind).toHaveBeenLastCalledWith({ department: DEPT });
  });

  it("kafedrasiz mudir hech narsa ko'rmaydi (fail-closed)", async () => {
    const u = user("kafedra_mudiri", "department");
    await expect(allowedResidentIds(u)).resolves.toEqual([]);
  });

  it("boshqa rollarda xulq O'ZGARMAYDI", async () => {
    await allowedResidentIds(user("klinik_ustoz", "self"));
    expect(mockFind).toHaveBeenLastCalledWith({ supervisor: ME });

    await allowedResidentIds(user("rezident", "self"));
    expect(mockFind).toHaveBeenLastCalledWith({ user: ME });

    await expect(allowedResidentIds(user("rektor", "global"))).resolves.toBeNull();
  });
});
