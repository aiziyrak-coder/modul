"use strict";

const { ErrorHandler } = require("#shared/error");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");

const MSG = Object.freeze({
  readonly:
    "Bu yozuv mashg'ulotdan avtomatik hosil qilingan — holat SAMS'dan, ball mashg'ulot sahifasidan qo'yiladi",
  notAbsent: "Mashg'ulot yozuvi «kelmadi» holatida emas — sababli qilib bo'lmaydi",
});

const conflict = (message, reason) => new ErrorHandler(409, message, reason, { reason });

async function loadRow(req, next) {
  try {
    return await Attendance.findById(req.params.id).select("session status").lean();
  } catch (err) {
    if (err?.name === "CastError") next();
    else next(err);
    return undefined;
  }
}

function guard(isDenied, message, reason) {
  return async (req, res, next) => {
    const row = await loadRow(req, next);
    if (row === undefined) return undefined;
    if (row && row.session && isDenied(row)) return next(conflict(message, reason));
    return next();
  };
}

const denySessionRowEdit = guard(() => true, MSG.readonly, "session_row_readonly");
const denySessionRowExcuse = guard((row) => row.status !== "absent", MSG.notAbsent, "session_row_not_absent");

module.exports = { denySessionRowEdit, denySessionRowExcuse, MSG };
