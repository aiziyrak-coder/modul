"use strict";

const { ROLES } = require("#config/constants");

const SUPERVISOR_ROLE_BY_PROGRAM = {
  magistratura: ROLES.ILMIY_RAHBAR,
  ordinatura: ROLES.KLINIK_USTOZ,
};

const sameId = (a, b) =>
  Boolean(a) && Boolean(b) && String(a._id || a) === String(b._id || b);

const ROLE_LABEL = {
  [ROLES.ILMIY_RAHBAR]: "ilmiy rahbar",
  [ROLES.KLINIK_USTOZ]: "klinik ustoz",
};

function checkSupervisorEligible(supervisor, program, scope = {}) {
  if (!supervisor) {
    return { ok: false, message: "Ustoz (foydalanuvchi) topilmadi" };
  }

  if (supervisor.active === false) {
    return { ok: false, message: "Bu foydalanuvchi faol emas — ustoz qilib biriktirib bo'lmaydi" };
  }

  const expected = SUPERVISOR_ROLE_BY_PROGRAM[program];
  if (!expected) {
    return { ok: false, message: "Rezidentning dasturi aniqlanmadi — ustoz biriktirib bo'lmaydi" };
  }

  const title = supervisor.role?.title;
  if (title !== expected) {
    return {
      ok: false,
      message:
        `Bu dasturga faqat ${ROLE_LABEL[expected]} biriktiriladi ` +
        `(tanlangan foydalanuvchining roli: ${title || "aniqlanmadi"})`,
    };
  }

  if (scope.restricted) {
    if (!scope.department) {
      return {
        ok: false,
        message: "Sizning kafedrangiz belgilanmagan — ustoz biriktirib bo'lmaydi",
      };
    }
    if (!sameId(supervisor.department, scope.department)) {
      return {
        ok: false,
        message:
          "Ustoz boshqa kafedradan — faqat o'z kafedrangiz ustozini biriktira olasiz",
      };
    }
  }

  return { ok: true };
}

module.exports = {
  checkSupervisorEligible,
  SUPERVISOR_ROLE_BY_PROGRAM,
};
