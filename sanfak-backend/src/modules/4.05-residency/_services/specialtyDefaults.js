"use strict";

const mongoose = require("mongoose");
const winston = require("#shared/winston.logger");

const SPECIALTY_FIELDS = "studyPeriod";

async function applySpecialtyDefaults(body = {}, current = null) {
  const specialtyId = body.specialty ?? current?.specialty ?? null;
  if (!specialtyId || !mongoose.isValidObjectId(specialtyId)) {
    return { body, derived: [] };
  }

  const givenNow = body.studyPeriod !== undefined && body.studyPeriod !== null;
  const alreadyHas = current?.studyPeriod !== undefined && current?.studyPeriod !== null;
  if (givenNow || alreadyHas) return { body, derived: [] };

  try {
    const spec = await mongoose
      .model("residencySpecialty")
      .findById(specialtyId)
      .select(SPECIALTY_FIELDS)
      .lean();

    if (!spec || spec.studyPeriod == null) return { body, derived: [] };

    return { body: { ...body, studyPeriod: spec.studyPeriod }, derived: ["studyPeriod"] };
  } catch (err) {
    winston.error(
      `[4.5] specialtyDefaults: mutaxassislikdan o'qib bo'lmadi ${specialtyId} — ${err.message}`,
    );
    return { body, derived: [] };
  }
}

function derivedWarnings(derived = [], body = {}) {
  return derived.includes("studyPeriod")
    ? [`O'qish muddati mutaxassislikdan olindi: ${body.studyPeriod} yil`]
    : [];
}

module.exports = { applySpecialtyDefaults, derivedWarnings, SPECIALTY_FIELDS };
