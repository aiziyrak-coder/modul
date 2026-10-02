"use strict";

const {
  createAttendanceSchema,
  updateAttendanceSchema,
} = require("./attendance.validation");
const { ATTENDANCE_STATUSES } = require("./attendance.model");

const RES = "6a5a0acbd34b3c21a575d59d";
const base = { resident: RES, date: "2026-08-20", samsVerified: true };
const ok = (schema, body) => schema.validate(body, { abortEarly: false });

describe("🔴 holat ro'yxati o'zgarmaydi", () => {
  it("`late` ATTENDANCE_STATUSES ga QO'SHILMAGAN", () => {
    expect(ATTENDANCE_STATUSES).toEqual(["present", "absent", "excused"]);
    expect(ATTENDANCE_STATUSES).not.toContain("late");
  });

  it("holat sifatida `late` yuborilsa RAD etiladi", () => {
    expect(ok(createAttendanceSchema, { ...base, status: "late" }).error).toBeDefined();
  });
});

describe("validator", () => {
  it("belgi va daqiqa qabul qilinadi", () => {
    const { error, value } = ok(createAttendanceSchema, {
      ...base,
      status: "present",
      late: true,
      lateMinutes: 15,
    });
    expect(error).toBeUndefined();
    expect(value.lateMinutes).toBe(15);
  });

  it("faqat belgi (daqiqasiz) ham mumkin", () => {
    expect(
      ok(createAttendanceSchema, { ...base, status: "present", late: true }).error,
    ).toBeUndefined();
  });

  it("`null` daqiqa — belgilanmagan", () => {
    expect(
      ok(createAttendanceSchema, {
        ...base,
        status: "present",
        late: true,
        lateMinutes: null,
      }).error,
    ).toBeUndefined();
  });

  it.each([0, -5, 601, 15.5, "yigirma"])("noto'g'ri daqiqa %p RAD etiladi", (v) => {
    expect(
      ok(createAttendanceSchema, { ...base, status: "present", lateMinutes: v }).error,
    ).toBeDefined();
  });

  it("tahrirlash sxemasida ham bor", () => {
    expect(ok(updateAttendanceSchema, { late: true, lateMinutes: 5 }).error).toBeUndefined();
  });
});

describe("normalizeLate", () => {
  const { normalizeLate: raw } = require("./attendance.controller");
  const normalizeLate = (payload, status) => {
    raw(payload, status);
    return payload;
  };

  it.each(["absent", "excused"])("`%s` da kechikish TOZALANADI", (status) => {
    expect(normalizeLate({ late: true, lateMinutes: 20 }, status)).toEqual({
      late: false,
      lateMinutes: null,
    });
  });

  it("tanada `late` bo'lmasa ham `absent` da tozalanadi", () => {
    expect(normalizeLate({ status: "absent" }, "absent")).toEqual({
      status: "absent",
      late: false,
      lateMinutes: null,
    });
  });

  it("daqiqa berilsa belgi AVTOMATIK qo'yiladi", () => {
    expect(normalizeLate({ lateMinutes: 15 }, "present")).toEqual({
      lateMinutes: 15,
      late: true,
    });
  });

  it("belgi olib tashlansa daqiqa ham tozalanadi", () => {
    expect(normalizeLate({ late: false, lateMinutes: 15 }, "present")).toEqual({
      late: false,
      lateMinutes: null,
    });
  });

  it("kechikmagan kelgan yozuvi tegilmaydi", () => {
    expect(normalizeLate({ status: "present", score: 90 }, "present")).toEqual({
      status: "present",
      score: 90,
    });
  });
});
