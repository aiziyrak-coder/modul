"use strict";

jest.mock("#modules/4.05-residency/resident/resident.model", () => ({
  find: jest.fn(),
  findById: jest.fn(),
  findOne: jest.fn(),
}));

const { canActForResident } = require("./residentScope");

const ME = "6a5a0acbd34b3c21a575d59d";
const OTHER = "6a5a0acbd34b3c21a575d5ff";
const DEPT = "6a5a0acbd34b3c21a575daaa";
const OTHER_DEPT = "6a5a0acbd34b3c21a575dbbb";

const user = (title, scopeLevel, extra = {}) => ({
  _id: ME,
  role: { title, scopeLevel },
  ...extra,
});

const resident = ({ owner = OTHER, supervisor = OTHER, department = OTHER_DEPT } = {}) => ({
  user: owner,
  supervisor,
  department,
});

describe("talaba (self)", () => {
  it("O'Z nomidan yarata oladi", () => {
    expect(canActForResident(user("magistrant", "self"), resident({ owner: ME }))).toBe(true);
  });

  it("BEGONA nomidan yarata OLMAYDI", () => {
    expect(canActForResident(user("magistrant", "self"), resident({ owner: OTHER }))).toBe(false);
  });

  it("rezident roli uchun ham xuddi shunday", () => {
    expect(canActForResident(user("rezident", "self"), resident({ owner: ME }))).toBe(true);
    expect(canActForResident(user("rezident", "self"), resident({ owner: OTHER }))).toBe(false);
  });
});

describe("ustoz / ilmiy rahbar", () => {
  it("BIRIKTIRILGAN talabasi uchun yarata oladi", () => {
    const u = user("klinik_ustoz", "department");
    expect(canActForResident(u, resident({ supervisor: ME }))).toBe(true);
  });

  it("begona talabaga yarata OLMAYDI", () => {
    const u = user("klinik_ustoz", "department");
    expect(canActForResident(u, resident({ supervisor: OTHER }))).toBe(false);
  });

  it("ilmiy_rahbar uchun ham xuddi shunday", () => {
    const u = user("ilmiy_rahbar", "department");
    expect(canActForResident(u, resident({ supervisor: ME }))).toBe(true);
    expect(canActForResident(u, resident({ supervisor: OTHER }))).toBe(false);
  });
});

describe("kafedra mudiri", () => {
  it("O'Z kafedrasi talabasiga yarata oladi", () => {
    const u = user("kafedra_mudiri", "department", { department: DEPT });
    expect(canActForResident(u, resident({ department: DEPT }))).toBe(true);
  });

  it("boshqa kafedraga yarata OLMAYDI", () => {
    const u = user("kafedra_mudiri", "department", { department: DEPT });
    expect(canActForResident(u, resident({ department: OTHER_DEPT }))).toBe(false);
  });
});

describe("cheklovsiz rollar — xulq O'ZGARMAYDI", () => {
  it.each([
    ["magistratura_bolim", "department"],
    ["rektor", "global"],
    ["super_admin", "global"],
  ])("%s har qanday talaba nomidan yarata oladi", (title, scopeLevel) => {
    expect(canActForResident(user(title, scopeLevel), resident())).toBe(true);
  });
});

describe("chegara holatlari", () => {
  it.each([null, undefined])("foydalanuvchi yo'q (%p) -> rad", (u) => {
    expect(canActForResident(u, resident())).toBe(false);
  });

  it("rezident hujjati topilmadi -> rad", () => {
    expect(canActForResident(user("magistrant", "self"), null)).toBe(false);
  });

  it("rolsiz foydalanuvchi -> rad (fail-closed)", () => {
    expect(canActForResident({ _id: ME }, resident({ owner: OTHER }))).toBe(false);
  });
});
