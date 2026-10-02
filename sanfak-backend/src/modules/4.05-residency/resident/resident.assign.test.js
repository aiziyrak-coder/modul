"use strict";

const {
  assignSupervisorSchema,
  createResidentSchema,
  updateResidentSchema,
} = require("./resident.validation");

const SUP = "6a5a0acbd34b3c21a575d59d";

const ok = (schema, body) => schema.validate(body, { abortEarly: false });

describe("weeklyHours — haftalik dars soati", () => {
  it("butun son qabul qilinadi", () => {
    const { error, value } = ok(assignSupervisorSchema, { supervisor: SUP, weeklyHours: 6 });
    expect(error).toBeUndefined();
    expect(value.weeklyHours).toBe(6);
  });

  it("kasr son ham qabul qilinadi", () => {
    expect(ok(assignSupervisorSchema, { supervisor: SUP, weeklyHours: 4.5 }).error).toBeUndefined();
  });

  it("0 RUXSAT etiladi", () => {
    expect(ok(assignSupervisorSchema, { supervisor: SUP, weeklyHours: 0 }).error).toBeUndefined();
  });

  it("`null` — biriktirishni bekor qilish/bo'shatish", () => {
    expect(ok(assignSupervisorSchema, { supervisor: SUP, weeklyHours: null }).error).toBeUndefined();
  });

  it("umuman berilmasa ham o'tadi (ixtiyoriy)", () => {
    expect(ok(assignSupervisorSchema, { supervisor: SUP }).error).toBeUndefined();
  });

  it("manfiy son RAD etiladi", () => {
    expect(ok(assignSupervisorSchema, { supervisor: SUP, weeklyHours: -1 }).error).toBeDefined();
  });

  it("60 dan katta son RAD etiladi (typo qalqoni)", () => {
    expect(ok(assignSupervisorSchema, { supervisor: SUP, weeklyHours: 600 }).error).toBeDefined();
    expect(ok(assignSupervisorSchema, { supervisor: SUP, weeklyHours: 60 }).error).toBeUndefined();
  });

  it("son bo'lmagan qiymat RAD etiladi", () => {
    expect(
      ok(assignSupervisorSchema, { supervisor: SUP, weeklyHours: "olti" }).error,
    ).toBeDefined();
  });
});

describe("🔴 mass-assignment — biriktirish maydonlari faqat SHU sxemada", () => {
  const base = { fullName: "Aliyev Sardor", program: "magistratura" };

  it.each(["weeklyHours", "supervisor", "teachingLocation", "practiceLocation", "scheduleText"])(
    "`%s` YARATISHDA qabul qilinmaydi",
    (field) => {
      const { error } = ok(createResidentSchema, { ...base, [field]: field === "weeklyHours" ? 6 : SUP });
      expect(error).toBeDefined();
      expect(error.message).toMatch(new RegExp(field));
    },
  );

  it.each(["weeklyHours", "supervisor", "teachingLocation", "practiceLocation", "scheduleText"])(
    "`%s` TAHRIRLASHDA ham qabul qilinmaydi",
    (field) => {
      const { error } = ok(updateResidentSchema, { [field]: field === "weeklyHours" ? 6 : SUP });
      expect(error).toBeDefined();
      expect(error.message).toMatch(new RegExp(field));
    },
  );
});

describe("Excel importi biriktirish ustunlarini rad etadi", () => {
  const { REJECTED } = require("#modules/4.05-residency/_services/rosterColumns");

  it("'dars soati' ustuni aniq xabar bilan rad etiladi", () => {
    const row = REJECTED.find((r) => r.aliases.includes("darssoati"));
    expect(row).toBeDefined();
    expect(row.reason).toMatch(/biriktirish oynasida/i);
  });
});

describe("supervisorName — snapshot mijozdan OLINMAYDI (MD-24)", () => {
  it("mijoz yuborgan nom Joi darajasidayoq TASHLANADI", () => {
    const { error, value } = ok(assignSupervisorSchema, {
      supervisor: SUP,
      supervisorName: "Kim Bo'lsa O'sha",
    });
    expect(error).toBeUndefined();
    expect(value).not.toHaveProperty("supervisorName");
  });

  it("nom yuborilgani UCHUN so'rov RAD ETILMAYDI (eski mijoz ishlayveradi)", () => {
    expect(ok(assignSupervisorSchema, { supervisor: SUP, supervisorName: "X" }).error)
      .toBeUndefined();
  });

  it("bo'sh/`null` nom ham xatoga olib kelmaydi", () => {
    expect(ok(assignSupervisorSchema, { supervisor: SUP, supervisorName: "" }).error).toBeUndefined();
    expect(ok(assignSupervisorSchema, { supervisor: SUP, supervisorName: null }).error).toBeUndefined();
  });
});

describe("composeFullName — snapshot manbasi (MD-24)", () => {
  const { composeFullName } = require("#modules/4.05-residency/_services/residentAccount");

  it("F.I.Sh tartibi: familiya · ism · sharif", () => {
    expect(
      composeFullName({ firstName: "Jasur", lastName: "Sobirov", middleName: "Nodirovich" }),
    ).toBe("Sobirov Jasur Nodirovich");
  });

  it("sharif yo'q bo'lsa ham tartib buzilmaydi", () => {
    expect(composeFullName({ firstName: "Dilnoza", lastName: "Ergasheva" })).toBe(
      "Ergasheva Dilnoza",
    );
  });

  it("bo'sh foydalanuvchi — bo'sh satr (controller uni `null` ga aylantiradi)", () => {
    expect(composeFullName({})).toBe("");
  });
});

describe("weeklyHours — yarim soatlik qadam (MD-39)", () => {
  const hours = (v) => ok(assignSupervisorSchema, { supervisor: SUP, weeklyHours: v }).error;

  it.each([0, 0.5, 1, 1.5, 4, 4.5, 6, 59.5, 60])("%p — QABUL", (v) => {
    expect(hours(v)).toBeUndefined();
  });

  it.each([6.25, 0.333333, 1.1, 2.75])("%p — RAD etiladi", (v) => {
    const err = hours(v);
    expect(err).toBeDefined();
    expect(err.message).toMatch(/yarim soatlik qadam/);
  });

  it("chegara xabari o'z o'rnida qoladi (qadam xabari bilan almashmaydi)", () => {
    expect(hours(-1).message).toMatch(/greater than or equal to 0/);
    expect(hours(61).message).toMatch(/less than or equal to 60/);
  });

  it("`null` — biriktirishni bo'shatish, qadam tekshirilmaydi", () => {
    expect(hours(null)).toBeUndefined();
  });
});
