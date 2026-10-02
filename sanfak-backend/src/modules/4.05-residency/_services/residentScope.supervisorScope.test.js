"use strict";

const { ROLES } = require("#config/constants");
const { supervisorScopeFor } = require("./residentScope");

const DEP = "6a5a0acbd34b3c21a575d001";

const withRole = (title, scopeLevel, extra = {}) => ({
  _id: "6a5a0acbd34b3c21a575d59d",
  role: { title, scopeLevel },
  ...extra,
});

describe("cheklanadi", () => {
  it("kafedra mudiri — o'z kafedrasi bilan", () => {
    expect(supervisorScopeFor(withRole(ROLES.KAFEDRA_MUDIRI, "department", { department: DEP })))
      .toEqual({ restricted: true, department: DEP });
  });

  it("kafedrasi belgilanmagan mudir ham CHEKLANADI", () => {
    expect(supervisorScopeFor(withRole(ROLES.KAFEDRA_MUDIRI, "department"))).toEqual({
      restricted: true,
      department: null,
    });
  });

  it("`scopeLevel` berilmagan mudir ham cheklanadi", () => {
    expect(
      supervisorScopeFor({ _id: "u1", role: { title: ROLES.KAFEDRA_MUDIRI }, department: DEP })
        .restricted,
    ).toBe(true);
  });
});

describe("cheklanmaydi", () => {
  it("bo'lim xodimi — modul admini, kafedralararo biriktira oladi", () => {
    expect(supervisorScopeFor(withRole(ROLES.MAGISTRATURA_BOLIM, "department"))).toEqual({
      restricted: false,
      department: null,
    });
  });

  it("`scopeLevel: global` bo'lgan mudir", () => {
    expect(
      supervisorScopeFor(withRole(ROLES.KAFEDRA_MUDIRI, "global", { department: DEP })).restricted,
    ).toBe(false);
  });

  it.each([ROLES.REKTOR, ROLES.KLINIK_USTOZ, ROLES.REZIDENT])(
    "%s — bu qoida unga tegishli emas",
    (title) => {
      expect(supervisorScopeFor(withRole(title, "self", { department: DEP })).restricted).toBe(
        false,
      );
    },
  );

  it("foydalanuvchi umuman yo'q — yiqilmaydi", () => {
    expect(supervisorScopeFor(undefined)).toEqual({ restricted: false, department: null });
  });

  it("roli yo'q foydalanuvchi", () => {
    expect(supervisorScopeFor({ _id: "u1" })).toEqual({ restricted: false, department: null });
  });
});
