"use strict";

jest.mock("#modules/4.05-residency/resident/resident.model", () => ({
  find: jest.fn(),
}));

const { canAccessResident, guardResident } = require("./residentScope");

const ID = (s) => ({ toString: () => s, _id: s });
const KAFEDRA_A = "aaaaaaaaaaaaaaaaaaaaaaaa";
const KAFEDRA_B = "bbbbbbbbbbbbbbbbbbbbbbbb";
const USTOZ_A = "1111111111111111aaaaaaaa";
const USTOZ_B = "2222222222222222bbbbbbbb";
const TALABA_U = "3333333333333333cccccccc";

const user = (title, scopeLevel, extra = {}) => ({
  _id: extra._id || "9999999999999999ffffffff",
  role: { title, scopeLevel },
  department: extra.department,
});

const resident = (over = {}) => ({
  _id: "7777777777777777dddddddd",
  department: KAFEDRA_A,
  supervisor: USTOZ_A,
  user: TALABA_U,
  ...over,
});

describe("canAccessResident — global rollar", () => {
  it("magistratura_bolim (bo'lim xodimi) hamma yozuvni o'qiydi va yozadi", () => {
    const u = user("magistratura_bolim", "self");
    expect(canAccessResident(u, resident(), "read")).toBe(true);
    expect(canAccessResident(u, resident(), "write")).toBe(true);
  });

  it("scopeLevel=global (rektor) hamma yozuvni o'qiydi", () => {
    const u = user("rektor", "global");
    expect(canAccessResident(u, resident(), "read")).toBe(true);
  });
});

describe("canAccessResident — kafedra mudiri (kafedra izolyatsiyasi)", () => {
  it("O'Z kafedrasidagi talabani o'qiydi va yozadi", () => {
    const u = user("kafedra_mudiri", "department", { department: KAFEDRA_A });
    expect(canAccessResident(u, resident(), "read")).toBe(true);
    expect(canAccessResident(u, resident(), "write")).toBe(true);
  });

  it("BOSHQA kafedradagi talabani KO'RA OLMAYDI", () => {
    const u = user("kafedra_mudiri", "department", { department: KAFEDRA_B });
    expect(canAccessResident(u, resident(), "read")).toBe(false);
    expect(canAccessResident(u, resident(), "write")).toBe(false);
  });

  it("kafedrasi biriktirilmagan mudir hech kimni ko'rmaydi (xavfsiz yopiladi)", () => {
    const u = user("kafedra_mudiri", "department", { department: undefined });
    expect(canAccessResident(u, resident(), "read")).toBe(false);
  });
});

describe("canAccessResident — ustoz rollari (biriktirish izolyatsiyasi)", () => {
  it("klinik_ustoz O'ZIGA biriktirilgan rezidentni ko'radi", () => {
    const u = user("klinik_ustoz", "department", { _id: USTOZ_A });
    expect(canAccessResident(u, resident(), "read")).toBe(true);
  });

  it("klinik_ustoz BOSHQA ustozning rezidentini ko'ra olmaydi", () => {
    const u = user("klinik_ustoz", "department", { _id: USTOZ_B });
    expect(canAccessResident(u, resident(), "read")).toBe(false);
    expect(canAccessResident(u, resident(), "write")).toBe(false);
  });

  it("ilmiy_rahbar ham xuddi shu qoida bo'yicha cheklanadi", () => {
    expect(
      canAccessResident(user("ilmiy_rahbar", "department", { _id: USTOZ_B }), resident(), "read"),
    ).toBe(false);
    expect(
      canAccessResident(user("ilmiy_rahbar", "department", { _id: USTOZ_A }), resident(), "read"),
    ).toBe(true);
  });

  it("biriktirilmagan (supervisor=null) yozuv ustozga ko'rinmaydi", () => {
    const u = user("klinik_ustoz", "department", { _id: USTOZ_A });
    expect(canAccessResident(u, resident({ supervisor: null }), "read")).toBe(false);
  });
});

describe("canAccessResident — talaba (self)", () => {
  it("O'Z yozuvini O'QIY oladi", () => {
    const u = user("rezident", "self", { _id: TALABA_U });
    expect(canAccessResident(u, resident(), "read")).toBe(true);
  });

  it("O'Z yozuvini ham TAHRIRLAY OLMAYDI (kontingentni bo'lim yuritadi)", () => {
    const u = user("rezident", "self", { _id: TALABA_U });
    expect(canAccessResident(u, resident(), "write")).toBe(false);
  });

  it("D2 REGRESSIYA: BEGONA talaba yozuvini o'qiy/tahrirlay OLMAYDI", () => {
    const u = user("rezident", "self", { _id: "0000000000000000eeeeeeee" });
    expect(canAccessResident(u, resident(), "read")).toBe(false);
    expect(canAccessResident(u, resident(), "write")).toBe(false);
  });

  it("magistrant uchun ham bir xil", () => {
    const u = user("magistrant", "self", { _id: "0000000000000000eeeeeeee" });
    expect(canAccessResident(u, resident(), "read")).toBe(false);
  });

  it("`user` bog'lanmagan (null) yozuv hech bir talabaga ochilmaydi", () => {
    const u = user("rezident", "self", { _id: TALABA_U });
    expect(canAccessResident(u, resident({ user: null }), "read")).toBe(false);
  });
});

describe("canAccessResident — buzuq kirish", () => {
  it("user yoki doc yo'q bo'lsa false", () => {
    expect(canAccessResident(null, resident())).toBe(false);
    expect(canAccessResident(user("rektor", "global"), null)).toBe(false);
  });

  it("roli yo'q foydalanuvchi self sifatida qaraladi (xavfsiz default)", () => {
    const u = { _id: TALABA_U, role: undefined };
    expect(canAccessResident(u, resident(), "read")).toBe(true);
    expect(canAccessResident(u, resident({ user: "boshqa" }), "read")).toBe(false);
  });

  it("ObjectId-ga o'xshash obyekt (populate qilingan) ham to'g'ri solishtiriladi", () => {
    const u = user("kafedra_mudiri", "department", { department: ID(KAFEDRA_A) });
    expect(canAccessResident(u, resident({ department: ID(KAFEDRA_A) }), "read")).toBe(true);
    expect(canAccessResident(u, resident({ department: ID(KAFEDRA_B) }), "read")).toBe(false);
  });
});

describe("guardResident — HTTP javobi", () => {
  const mkRes = () => {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
  };

  it("ruxsat bo'lsa true qaytaradi va javob YUBORMAYDI", () => {
    const res = mkRes();
    const req = { user: user("magistratura_bolim", "self") };
    expect(guardResident(req, res, resident(), "read")).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("ruxsat bo'lmasa 404 yuboradi va false qaytaradi (403 EMAS — mavjudlik oshkor bo'lmasin)", () => {
    const res = mkRes();
    const req = { user: user("rezident", "self", { _id: "begona" }) };
    expect(guardResident(req, res, resident(), "read")).toBe(false);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "not found" });
  });
});
