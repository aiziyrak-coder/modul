"use strict";

const { toMinutes } = require("#modules/4.05-residency/residencySetting/residencySetting.model");

const GATED_PROGRAM = "ordinatura";

const MSG = {
  notPresent:
    "Ball faqat «keldi» holatidagi mashg'ulotga qo'yiladi — avval davomatni belgilang",
  notVerified:
    "Kelgani tasdiqlanmagan (SAMS yoki qo'lda tasdiq yo'q) — ball qo'yib bo'lmaydi",
  outsideWindow: (from, to) =>
    `Rezident klinik ish kunida (${from}–${to}) klinikada bo'lgani qayd etilmagan — ball qo'yilmadi`,
};

function checkScoreWindow(row = {}, settings = {}) {
  if (row.program !== GATED_PROGRAM) return { ok: true };

  if (row.status !== "present") return { ok: false, message: MSG.notPresent };

  if (!row.samsVerified && !row.manualVerified) {
    return { ok: false, message: MSG.notVerified };
  }

  const inAt = toMinutes(row.checkInTime);
  const outAt = toMinutes(row.checkOutTime);

  if (inAt === null || outAt === null) return { ok: true };

  const from = toMinutes(settings.workDayFrom);
  const to = toMinutes(settings.workDayTo);
  if (from === null || to === null) return { ok: true };

  if (!(inAt < to && outAt > from)) {
    return {
      ok: false,
      message: MSG.outsideWindow(settings.workDayFrom, settings.workDayTo),
    };
  }

  return { ok: true };
}

module.exports = { checkScoreWindow, GATED_PROGRAM, MSG };
