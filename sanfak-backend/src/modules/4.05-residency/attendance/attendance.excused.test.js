"use strict";

const fs = require("fs");
const path = require("path");

const {
  createAttendanceSchema,
  updateAttendanceSchema,
  listQuery,
} = require("./attendance.validation");
const {
  ATTENDANCE_STATUSES,
  CLIENT_ATTENDANCE_STATUSES,
} = require("./attendance.model");

const RESIDENT = "64b7f1c2e4b0a1a2b3c4d5e6";
const base = { resident: RESIDENT, date: "2026-09-05" };

describe("D-18 — `excused` mijoz yoza oladigan holatlar ro'yxatida YO'Q", () => {
  it("modelda uchala holat qoladi, mijozda esa ikkitasi", () => {
    expect(ATTENDANCE_STATUSES).toEqual(["present", "absent", "excused"]);
    expect(CLIENT_ATTENDANCE_STATUSES).toEqual(["present", "absent"]);
  });

  it("🔴 YARATISHDA `excused` RAD etiladi", () => {
    const { error } = createAttendanceSchema.validate({
      ...base,
      status: "excused",
    });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/status/);
  });

  it("🔴 TAHRIRLASHDA ham `excused` RAD etiladi", () => {
    const { error } = updateAttendanceSchema.validate({ status: "excused" });
    expect(error).toBeDefined();
  });

  it("`present` va `absent` QABUL qilinadi (oqim buzilmaydi)", () => {
    expect(
      createAttendanceSchema.validate({ ...base, status: "absent" }).error,
    ).toBeUndefined();
    expect(
      updateAttendanceSchema.validate({ status: "present" }).error,
    ).toBeUndefined();
  });

  it("🔴 FILTRDA `excused` QOLADI — sababli qatorlarni izlash kerak", () => {
    expect(listQuery.validate({ status: "excused" }).error).toBeUndefined();
  });
});

describe("D-18 — `/approve-excuse` marshruti `approve` bilan yopilgan", () => {
  const routes = fs.readFileSync(
    path.join(__dirname, "attendance.routes.js"),
    "utf8",
  );

  it("gate `update` EMAS, `approve`", () => {
    const block = routes.slice(routes.indexOf('"/:id/approve-excuse"'));
    const chain = block.slice(0, block.indexOf("Controller.approveExcuse"));

    expect(chain).toContain("permitApproveExcuse");
    expect(chain).not.toContain("permitUpdate");
  });

  it("`permitApproveExcuse` ACTIONS.APPROVE dan qurilgan", () => {
    expect(routes).toMatch(
      /const permitApproveExcuse = permit\(\s*MODULES\.RESIDENT_ATTENDANCE,\s*\[\s*ACTIONS\.APPROVE,?\s*\]/,
    );
  });
});
