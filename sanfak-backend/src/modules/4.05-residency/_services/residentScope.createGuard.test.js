"use strict";

const {
  canCreateResident,
  guardCreateResident,
  CREATE_SCOPE_DENIED,
} = require("./residentScope");

const DEP = "6a5a0acbd34b3c21a575d001";
const OTHER_DEP = "6a5a0acbd34b3c21a575d002";
const ME = "6a5a0acbd34b3c21a575d59d";

const withRole = (title, scopeLevel, extra = {}) => ({
  _id: ME,
  role: { title, scopeLevel },
  ...extra,
});

const mudir = withRole("kafedra_mudiri", "department", { department: DEP });
const bolim = withRole("magistratura_bolim", "department");
const globalRole = withRole("rektor", "global");
const ustoz = withRole("klinik_ustoz", "self");
const talaba = withRole("rezident", "self");

describe("cheklovsiz rollar", () => {
  it("bo'lim xodimi — istalgan kafedraga", () => {
    expect(canCreateResident(bolim, { department: OTHER_DEP })).toBe(true);
  });

  it("bo'lim xodimi — kafedrasiz yozuv ham mumkin", () => {
    expect(canCreateResident(bolim, {})).toBe(true);
  });

  it("`scopeLevel: global` — istalgan kafedraga", () => {
    expect(canCreateResident(globalRole, { department: OTHER_DEP })).toBe(true);
  });
});

describe("kafedra mudiri — faqat O'Z kafedrasi", () => {
  it("o'z kafedrasi — ruxsat", () => {
    expect(canCreateResident(mudir, { department: DEP })).toBe(true);
  });

  it("🔴 BEGONA kafedra — rad etiladi", () => {
    expect(canCreateResident(mudir, { department: OTHER_DEP })).toBe(false);
  });

  it("kafedra ko'rsatilmagan — rad etiladi", () => {
    expect(canCreateResident(mudir, {})).toBe(false);
    expect(canCreateResident(mudir, { department: null })).toBe(false);
  });

  it("populate qilingan kafedra obyekti ham taniladi", () => {
    expect(canCreateResident(mudir, { department: { _id: DEP, title: "X" } })).toBe(true);
  });

  it("kafedrasi belgilanmagan mudir hech qayerga yoza olmaydi", () => {
    const noDept = withRole("kafedra_mudiri", "department");
    expect(canCreateResident(noDept, { department: DEP })).toBe(false);
  });
});

describe("yaratish huquqi yo'q rollar", () => {
  it.each([
    ["klinik ustoz", ustoz],
    ["talaba", talaba],
  ])("%s — rad etiladi", (_label, user) => {
    expect(canCreateResident(user, { department: DEP })).toBe(false);
  });

  it("foydalanuvchi umuman yo'q", () => {
    expect(canCreateResident(undefined, { department: DEP })).toBe(false);
  });
});

describe("guardCreateResident — controller ko'rinishi", () => {
  const makeRes = () => {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
  };

  it("ruxsat bo'lsa `true` qaytadi va javob YOZILMAYDI", () => {
    const res = makeRes();
    expect(guardCreateResident({ user: mudir }, res, { department: DEP })).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rad etilsa 403 + tushunarli xabar", () => {
    const res = makeRes();
    expect(guardCreateResident({ user: mudir }, res, { department: OTHER_DEP })).toBe(false);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: CREATE_SCOPE_DENIED });
  });

  it("xabar xodimga NIMA qilish kerakligini aytadi", () => {
    expect(CREATE_SCOPE_DENIED).toContain("Kafedra");
  });
});
