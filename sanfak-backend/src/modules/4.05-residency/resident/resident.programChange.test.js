"use strict";

const { programChange, PROGRAM_CHANGE_BLOCKED } = require("./resident.controller");

const SUP = "6a5a0acbd34b3c21a575d59d";

const magistrant = { program: "magistratura" };
const magistrantWithSupervisor = { program: "magistratura", supervisor: SUP };

describe("o'zgarish YO'Q", () => {
  it("`program` umuman yuborilmagan (qisman tahrirlash)", () => {
    expect(programChange({ phone: "+998901112233" }, magistrantWithSupervisor)).toEqual({
      changed: false,
      blocked: false,
    });
  });

  it("AYNI qiymat qayta yuborilgan — forma butun obyektni yuboradi", () => {
    expect(programChange({ program: "magistratura" }, magistrantWithSupervisor)).toEqual({
      changed: false,
      blocked: false,
    });
  });

  it("bo'sh body", () => {
    expect(programChange({}, magistrantWithSupervisor).changed).toBe(false);
  });

  it("argumentlarsiz ham yiqilmaydi", () => {
    expect(programChange()).toEqual({ changed: false, blocked: false });
  });
});

describe("dastur o'zgardi", () => {
  it("ustoz biriktirilmagan — o'tadi", () => {
    expect(programChange({ program: "ordinatura" }, magistrant)).toEqual({
      changed: true,
      blocked: false,
    });
  });

  it("🔴 ustoz BIRIKTIRILGAN — bloklanadi", () => {
    expect(programChange({ program: "ordinatura" }, magistrantWithSupervisor)).toEqual({
      changed: true,
      blocked: true,
    });
  });

  it("teskari yo'nalish ham bir xil (ordinatura -> magistratura)", () => {
    expect(
      programChange({ program: "magistratura" }, { program: "ordinatura", supervisor: SUP }),
    ).toEqual({ changed: true, blocked: true });
  });

  it("faqat `supervisorName` qolgan bo'lsa bloklanmaydi", () => {
    expect(
      programChange(
        { program: "ordinatura" },
        { program: "magistratura", supervisorName: "Aliyev Sardor" },
      ).blocked,
    ).toBe(false);
  });

  it("`supervisor: null` — biriktirish bekor qilingan", () => {
    expect(
      programChange({ program: "ordinatura" }, { program: "magistratura", supervisor: null })
        .blocked,
    ).toBe(false);
  });
});

describe("xato xabari", () => {
  it("xodimga NIMA qilish kerakligini aytadi", () => {
    expect(PROGRAM_CHANGE_BLOCKED).toContain("ustoz biriktirishni bekor qiling");
  });
});
