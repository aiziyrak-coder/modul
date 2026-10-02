"use strict";

const { PII_FIELDS, canSeeStudentPii, stripStudentPii } = require("./studentPii");

const perm = (section, ...actionKeys) => ({ section, actionKeys });
const role = (...permissions) => ({ title: "nom_ahamiyatsiz", permissions });

const BOLIM = role(
  perm("giftedStudent", "create", "read", "readAll", "update", "delete", "export"),
  perm("studentAchievement", "create", "read", "readAll", "approve"),
  perm("scholarshipApplication", "readAll", "update", "score"),
  perm("scholarship", "create", "readAll"),
  perm("chat", "create", "read", "readAll"),
);
const HAKAM = role(
  perm("giftedStudent", "read"),
  perm("studentAchievement", "readAll"),
  perm("scholarshipApplication", "readAll", "score"),
);
const MASLAHATCHI = role(
  perm("giftedStudent", "read", "readAll"),
  perm("studentAchievement", "read", "readAll"),
  perm("chat", "create", "read", "readAll"),
);
const RAHBAR = role(
  perm("giftedStudent", "read", "readAll"),
  perm("studentAchievement", "readAll"),
  perm("scholarshipApplication", "readAll"),
);
const TALABA = role(
  perm("giftedStudent", "read"),
  perm("studentAchievement", "create", "read", "readAll"),
  perm("chat", "create", "read", "readAll"),
);

const user = (r, id = "u-boshqa") => ({ _id: id, role: r });

const student = (over = {}) => ({
  _id: "6a7efdac5916905f06cebeac",
  user: "u-talaba",
  fullName: "Aliyev Sardor Botir o'g'li",
  faculty: "Davolash ishi",
  course: 3,
  totalScore: 48,
  jshshir: "12345678901234",
  passportSeria: "AA",
  passportNumber: "1234567",
  email: "s.aliyev@fjsti.uz",
  phone: "+998 90 123 45 67",
  ...over,
});

const hasNoPii = (doc) => PII_FIELDS.every((f) => !(f in doc));
const hasAllPii = (doc) => PII_FIELDS.every((f) => f in doc);

describe("canSeeStudentPii", () => {
  it("ro'yxat egasi (giftedStudent:create) ko'radi — formani u to'ldiradi", () => {
    expect(canSeeStudentPii(user(BOLIM))).toBe(true);
  });

  it("super_admin ko'radi (ruxsatlari bo'sh bo'lsa ham — NOM-bypass)", () => {
    expect(canSeeStudentPii({ _id: "u1", role: { title: "super_admin", permissions: [] } })).toBe(true);
  });

  it.each([
    ["hakam", HAKAM],
    ["maslahatchi", MASLAHATCHI],
    ["rahbariyat", RAHBAR],
    ["talaba", TALABA],
  ])("%s ko'rmaydi", (_nom, r) => {
    expect(canSeeStudentPii(user(r))).toBe(false);
  });

  it("rolsiz/anonim ko'rmaydi (fail-closed)", () => {
    expect(canSeeStudentPii(undefined)).toBe(false);
    expect(canSeeStudentPii({ _id: "u1" })).toBe(false);
  });
});

describe("stripStudentPii — bitta yozuv", () => {
  it("hakamdan JSHSHIR, pasport, e-pochta va telefon kesiladi", () => {
    const out = stripStudentPii(student(), user(HAKAM));
    expect(hasNoPii(out)).toBe(true);
  });

  it("kesishdan keyin baholash uchun kerakli maydonlar JOYIDA qoladi", () => {
    const out = stripStudentPii(student(), user(HAKAM));
    expect(out).toMatchObject({
      fullName: "Aliyev Sardor Botir o'g'li",
      faculty: "Davolash ishi",
      course: 3,
      totalScore: 48,
    });
  });

  it("bo'lim xodimida hech narsa kesilmaydi", () => {
    expect(hasAllPii(stripStudentPii(student(), user(BOLIM)))).toBe(true);
  });

  it("talaba O'Z yozuvidagi PII ni ko'radi", () => {
    const out = stripStudentPii(student(), user(TALABA, "u-talaba"));
    expect(hasAllPii(out)).toBe(true);
  });

  it("talaba BOSHQA talabaning PII sini ko'rmaydi", () => {
    const out = stripStudentPii(student(), user(TALABA, "u-boshqa-talaba"));
    expect(hasNoPii(out)).toBe(true);
  });

  it("akkaunti bog'lanmagan yozuv 'o'zimniki' deb hisoblanmaydi", () => {
    const out = stripStudentPii(student({ user: null }), { _id: undefined, role: HAKAM });
    expect(hasNoPii(out)).toBe(true);
  });

  it("null/undefined javob yiqilmaydi", () => {
    expect(stripStudentPii(null, user(HAKAM))).toBeNull();
    expect(stripStudentPii(undefined, user(HAKAM))).toBeUndefined();
  });
});

describe("stripStudentPii — ro'yxat", () => {
  it("massivdagi HAR BIR yozuvdan kesiladi", () => {
    const rows = [student(), student({ _id: "x2", user: "u-2", fullName: "Iqtidorov Sanjar" })];
    stripStudentPii(rows, user(RAHBAR));
    expect(rows.every(hasNoPii)).toBe(true);
  });

  it("ro'yxatda ham faqat O'Z yozuvi ochiq qoladi", () => {
    const rows = [student(), student({ _id: "x2", user: "u-2" })];
    stripStudentPii(rows, user(TALABA, "u-2"));
    expect(hasNoPii(rows[0])).toBe(true);
    expect(hasAllPii(rows[1])).toBe(true);
  });

  it("massiv AYNI havola bo'lib qaytadi (paginate javob shakli buzilmaydi)", () => {
    const rows = [student()];
    expect(stripStudentPii(rows, user(HAKAM))).toBe(rows);
  });
});
