"use strict";

const fs = require("fs");
const path = require("path");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const { denySessionRowEdit, denySessionRowExcuse } = require("./sessionRowGuard");

const rowIs = (value) => {
  const lean = typeof value === "function" ? jest.fn(value) : jest.fn().mockResolvedValue(value);
  jest.spyOn(Attendance, "findById").mockReturnValue({ select: () => ({ lean }) });
};
const run = async (mw) => {
  const next = jest.fn();
  await mw({ params: { id: "a1" } }, {}, next);
  return next;
};
const castError = () => Promise.reject(Object.assign(new Error("Cast to ObjectId failed"), { name: "CastError" }));

afterEach(() => jest.restoreAllMocks());

describe("denySessionRowEdit — PUT /attendance/:id", () => {
  test("sessiya qatori — 409 session_row_readonly", async () => {
    rowIs({ _id: "a1", session: "s1", status: "absent" });
    const next = await run(denySessionRowEdit);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409, meta: { reason: "session_row_readonly" } }));
    expect(Attendance.findById).toHaveBeenCalledWith("a1");
  });

  test.each([
    ["qo'lda qator", { _id: "a1", session: null, status: "absent" }],
    ["eski qator (maydon yo'q)", { _id: "a1", status: "present" }],
    ["qator yo'q (controller 404)", null],
  ])("%s — next()", async (_label, row) => {
    rowIs(row);
    const next = await run(denySessionRowEdit);
    expect(next).toHaveBeenCalledWith();
  });

  test("CastError — next() (controller o'z 400 ini beradi); boshqa xato — next(err)", async () => {
    rowIs(castError);
    expect(await run(denySessionRowEdit)).toHaveBeenCalledWith();
    const boom = new Error("db down");
    rowIs(() => Promise.reject(boom));
    expect(await run(denySessionRowEdit)).toHaveBeenCalledWith(boom);
  });
});

describe("denySessionRowExcuse — PUT /attendance/:id/approve-excuse", () => {
  test.each([
    ["sessiya qatori absent — ruxsat", { session: "s1", status: "absent" }, null],
    ["sessiya qatori present — 409", { session: "s1", status: "present" }, "session_row_not_absent"],
    ["sessiya qatori excused — 409", { session: "s1", status: "excused" }, "session_row_not_absent"],
    ["qo'lda qator excused — ruxsat (eski xulq)", { session: null, status: "excused" }, null],
  ])("%s", async (_label, row, reason) => {
    rowIs(row);
    const next = await run(denySessionRowExcuse);
    if (reason) expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409, meta: { reason } }));
    else expect(next).toHaveBeenCalledWith();
  });
});

describe("attendance.routes — qo'riqchi controller'dan OLDIN, validatorlardan KEYIN", () => {
  const routes = fs
    .readFileSync(path.join(__dirname, "../attendance/attendance.routes.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");
  const block = (start) => routes.slice(routes.indexOf(start), routes.indexOf(");", routes.indexOf(start)));

  test.each([
    ['"/:id",', ["permitUpdate", "validator.params(V.idSchema)", "validator.body(V.updateAttendanceSchema)", "denySessionRowEdit", "Controller.updateAttendance"]],
    ['"/:id/approve-excuse",', ["permitApproveExcuse", "validator.params(V.idSchema)", "validator.body(V.approveExcuseSchema)", "denySessionRowExcuse", "Controller.approveExcuse"]],
  ])("%s", (start, parts) => {
    const chain = block(start);
    const idx = parts.map((p) => chain.indexOf(p));
    idx.forEach((i) => expect(i).toBeGreaterThan(-1));
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
  });

  test("router haqiqatan yuklanadi", () => {
    const router = require("../attendance/attendance.routes");
    const put = router.stack.find((l) => l.route?.path === "/:id" && l.route.methods.put);
    expect(put.route.stack.map((s) => s.handle)).toContain(denySessionRowEdit);
  });
});
