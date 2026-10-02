"use strict";

const {
  canAccessNotice,
} = require("./residencyNotice.controller");

const ME = "6a5a0acbd34b3c21a575d59d";
const OTHER = "6a5a0acbd34b3c21a575d5ff";
const MY_RESIDENT = "6a5a0acbd34b3c21a575daaa";
const OTHER_RESIDENT = "6a5a0acbd34b3c21a575dbbb";

const user = { _id: ME };

describe("cheklovsiz doira (bo'lim / global)", () => {
  it("`ids === null` — har qanday bildirgi ochiladi", () => {
    expect(canAccessNotice(user, { sender: OTHER, resident: OTHER_RESIDENT }, null)).toBe(true);
  });
});

describe("o'zi YUBORGAN bildirgi", () => {
  it("xom ObjectId shaklida", () => {
    expect(canAccessNotice(user, { sender: ME }, [])).toBe(true);
  });

  it("POPULATE qilingan Document shaklida ham", () => {
    const populated = { sender: { _id: ME, firstName: "Klinik" } };
    expect(canAccessNotice(user, populated, [])).toBe(true);
  });
});

describe("o'z talabasi haqidagi bildirgi", () => {
  it("xom ObjectId", () => {
    expect(canAccessNotice(user, { sender: OTHER, resident: MY_RESIDENT }, [MY_RESIDENT])).toBe(true);
  });

  it("POPULATE qilingan Document", () => {
    const doc = { sender: OTHER, resident: { _id: MY_RESIDENT, fullName: "X" } };
    expect(canAccessNotice(user, doc, [MY_RESIDENT])).toBe(true);
  });
});

describe("BEGONA bildirgi — rad etiladi", () => {
  it("boshqa ustoz yuborgan, talabasi ham begona", () => {
    expect(
      canAccessNotice(user, { sender: OTHER, resident: OTHER_RESIDENT }, [MY_RESIDENT]),
    ).toBe(false);
  });

  it("`resident` null bo'lsa ham ochilmaydi", () => {
    expect(canAccessNotice(user, { sender: OTHER, resident: null }, [])).toBe(false);
  });

  it("bo'sh doira (hech kim biriktirilmagan) — faqat o'zi yuborgani", () => {
    expect(canAccessNotice(user, { sender: OTHER, resident: OTHER_RESIDENT }, [])).toBe(false);
    expect(canAccessNotice(user, { sender: ME, resident: OTHER_RESIDENT }, [])).toBe(true);
  });
});
