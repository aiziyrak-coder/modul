"use strict";

const { duplicateReason } = require("./residentOnboarding");

const existing = (over = {}) => ({
  _id: "r1",
  user: null,
  jshshir: null,
  passportSeria: null,
  passportNumber: null,
  ...over,
});

describe("duplicateReason", () => {
  it("dublikat topilmagan bo'lsa — null", () => {
    expect(duplicateReason(null, { jshshir: "12345678901234" })).toBeNull();
  });

  it("akkaunt bo'yicha to'qnashuv", () => {
    expect(
      duplicateReason(existing({ user: "u1" }), { userId: "u1" }),
    ).toBe("user");
  });

  it("JSHSHIR bo'yicha to'qnashuv", () => {
    expect(
      duplicateReason(existing({ jshshir: "12345678901234" }), {
        jshshir: "12345678901234",
      }),
    ).toBe("jshshir");
  });

  it("🔴 PASPORT bo'yicha — jonli o'lchangan holat", () => {
    expect(
      duplicateReason(existing({ passportSeria: "AB", passportNumber: "7654321" }), {
        jshshir: null,
        passportSeria: "AB",
        passportNumber: "7654321",
      }),
    ).toBe("passport");
  });

  it("pasportning FAQAT bir qismi mos kelsa — sabab emas", () => {
    expect(
      duplicateReason(existing({ passportSeria: "AB", passportNumber: "1111111" }), {
        passportSeria: "AB",
        passportNumber: "7654321",
      }),
    ).toBeNull();
  });

  it("bo'sh kalitlar tasodifan «mos» kelmaydi", () => {
    expect(duplicateReason(existing(), {})).toBeNull();
    expect(duplicateReason(existing(), { jshshir: "", passportSeria: "", passportNumber: "" })).toBeNull();
  });

  it("mavjud yozuvda akkaunt yo'q, so'rovda bor — «user» EMAS", () => {
    expect(duplicateReason(existing({ user: null }), { userId: "u1" })).toBeNull();
  });

  it("bir vaqtda bir nechta mos kelsa — eng aniqi (akkaunt) qaytadi", () => {
    expect(
      duplicateReason(
        existing({ user: "u1", jshshir: "12345678901234" }),
        { userId: "u1", jshshir: "12345678901234" },
      ),
    ).toBe("user");
  });

  it("tartib `duplicateQuery` bilan bir xil: JSHSHIR pasportdan oldin", () => {
    expect(
      duplicateReason(
        existing({ jshshir: "12345678901234", passportSeria: "AB", passportNumber: "7654321" }),
        { jshshir: "12345678901234", passportSeria: "AB", passportNumber: "7654321" },
      ),
    ).toBe("jshshir");
  });
});
