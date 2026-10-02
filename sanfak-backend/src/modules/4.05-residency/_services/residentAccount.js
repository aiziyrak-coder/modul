"use strict";

const mongoose = require("mongoose");
const winston = require("#shared/winston.logger");
const { ROLES } = require("#config/constants");
const { RESIDENT_STUDENT, roleMatches, rolesMatching } = require("./residentRoles");

const PIN_RE = /^\d{14}$/;

const PASSPORT_NUMBER_RE = /^\d{7}$/;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLE_BY_PROGRAM = {
  magistratura: ROLES.MAGISTRANT,
  ordinatura: ROLES.REZIDENT,
};

const str = (v) => (typeof v === "string" ? v.trim() : "");

function splitFullName(fullName) {
  const parts = str(fullName).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { lastName: "", firstName: "", middleName: "" };
  if (parts.length === 1) return { lastName: parts[0], firstName: "", middleName: "" };
  return {
    lastName: parts[0],
    firstName: parts[1],
    middleName: parts.slice(2).join(" "),
  };
}

function composeFullName({ lastName, firstName, middleName }) {
  return [lastName, firstName, middleName].map(str).filter(Boolean).join(" ");
}

function resolveNameParts(body = {}) {
  const explicit = {
    lastName: str(body.lastName),
    firstName: str(body.firstName),
    middleName: str(body.middleName),
  };

  if (explicit.lastName && explicit.firstName) {
    return {
      ...explicit,
      fullName: str(body.fullName) || composeFullName(explicit),
      guessed: false,
    };
  }

  const guessedParts = splitFullName(body.fullName);
  return {
    ...guessedParts,
    fullName: str(body.fullName) || composeFullName(guessedParts),
    guessed: true,
  };
}

async function resolveResidentRole(program) {
  const title = ROLE_BY_PROGRAM[str(program)];
  if (!title) return { id: null, ambiguous: 0 };

  const byTitle = await mongoose
    .model("role")
    .findOne({ title })
    .select("_id")
    .lean();
  if (byTitle) return { id: byTitle._id };

  const ids = await rolesMatching(RESIDENT_STUDENT);
  if (ids.length === 1) {
    winston.warn(
      `[residency:account] "${title}" roli topilmadi — ruxsat profiliga mos YAGONA rol tanlandi (${ids[0]}). Rol qayta nomlangan bo'lsa seed'ni yangilang.`,
    );
    return { id: ids[0], guessed: true, title };
  }

  return { id: null, ambiguous: ids.length, title };
}

function contactFields(src = {}, warnings) {
  const out = {};

  const email = str(src.email);
  if (email) {
    if (EMAIL_RE.test(email)) out.email = email;
    else warnings.push(`Email formati noto'g'ri ("${email}") — akkauntga yozilmadi`);
  }

  const phone = str(src.phone);
  if (phone) out.phone = phone;

  const seria = str(src.passportSeria);
  if (seria) out.passportSeria = seria;

  const number = str(src.passportNumber);
  if (number) {
    if (PASSPORT_NUMBER_RE.test(number)) out.passportNumber = number;
    else
      warnings.push(
        `Pasport raqami aniq 7 ta raqam emas ("${number}") — akkauntga yozilmadi`,
      );
  }

  return out;
}

async function provisionAccount({
  jshshir,
  program,
  lastName,
  firstName,
  middleName,
  contact,
  dryRun = false,
}) {
  const warnings = [];
  const skip = (reason) => {
    warnings.push(reason);
    return { userId: null, status: "skipped", createdHere: false, warnings };
  };

  const pin = str(jshshir);
  if (!PIN_RE.test(pin)) {
    return skip(
      "JSHSHIR 14 xonali raqam emas — platforma akkaunti yaratilmadi (talaba tizimga kira olmaydi)",
    );
  }
  if (!str(lastName) || !str(firstName)) {
    return skip(
      "Familiya va ism aniqlanmadi — platforma akkaunti yaratilmadi (ikkalasi ham majburiy)",
    );
  }

  const User = mongoose.model("user");

  const existing = await User.findOne({ oneIdPin: pin })
    .select("_id role")
    .populate({ path: "role", select: "title permissions" })
    .lean();

  if (existing) {
    if (!roleMatches(existing.role, RESIDENT_STUDENT)) {
      return skip(
        `Bu JSHSHIR allaqachon boshqa toifadagi akkauntga tegishli (${existing.role?.title || "rolsiz"}) — talabaga bog'lanmadi`,
      );
    }
    return { userId: existing._id, status: "existing", createdHere: false, warnings };
  }

  const role = await resolveResidentRole(program);
  if (!role.id) {
    winston.warn(
      `[residency:account] "${program}" uchun rol aniqlanmadi (mos rollar: ${role.ambiguous})`,
    );
    return skip(
      role.ambiguous > 1
        ? `"${program}" uchun rol aniqlanmadi — ruxsat profiliga ${role.ambiguous} ta rol mos keldi, akkaunt yaratilmadi`
        : `"${role.title || program}" roli ma'lumotlar bazasida yo'q — akkaunt yaratilmadi (seed ishga tushirilsin)`,
    );
  }
  if (role.guessed) {
    warnings.push(
      `"${role.title}" roli topilmadi — ruxsati mos keladigan yagona rol ishlatildi`,
    );
  }

  if (dryRun) {
    contactFields(contact, warnings);
    return { userId: null, status: "created", createdHere: false, warnings };
  }

  try {
    const doc = await User.create({
      lastName: str(lastName),
      firstName: str(firstName),
      ...(str(middleName) ? { middleName: str(middleName) } : {}),
      ...contactFields(contact, warnings),
      oneIdPin: pin,
      role: role.id,
      active: true,
    });
    return { userId: doc._id, status: "created", createdHere: true, warnings };
  } catch (err) {
    if (err?.code === 11000) {
      const raced = await User.findOne({ oneIdPin: pin }).select("_id").lean();
      if (raced) {
        return { userId: raced._id, status: "existing", createdHere: false, warnings };
      }
    }
    throw err;
  }
}

async function discardAccount(userId) {
  if (!userId) return;
  try {
    await mongoose.model("user").findByIdAndDelete(userId);
  } catch (err) {
    winston.error(
      `[residency:account] kompensatsiya muvaffaqiyatsiz, yetim akkaunt qoldi (${userId}): ${err.message}`,
    );
  }
}

module.exports = {
  PIN_RE,
  ROLE_BY_PROGRAM,
  splitFullName,
  composeFullName,
  resolveNameParts,
  resolveResidentRole,
  contactFields,
  provisionAccount,
  discardAccount,
};
