"use strict";

const mongoose = require("mongoose");
const winston = require("#shared/winston.logger");
const {
  splitFullName,
  composeFullName,
  resolveResidentRole,
  ROLE_BY_PROGRAM,
} = require("./residentAccount");
const { RESIDENT_STUDENT, roleMatches } = require("./residentRoles");

const DIRECT_FIELDS = ["email", "phone", "passportSeria", "passportNumber"];

const str = (v) => (typeof v === "string" ? v.trim() : "");
const orNull = (v) => (str(v) === "" ? null : str(v));

function buildAccountPatch(body = {}, user = {}) {
  const patch = {};
  const fields = [];
  let nameGuessed = false;

  for (const key of DIRECT_FIELDS) {
    if (!Object.hasOwn(body, key)) continue;
    const next = orNull(body[key]);
    if (next === (user[key] ?? null)) continue;
    patch[key] = next;
    fields.push(key);
  }

  const hasExplicitParts =
    Object.hasOwn(body, "lastName") ||
    Object.hasOwn(body, "firstName") ||
    Object.hasOwn(body, "middleName");

  if (hasExplicitParts) {
    const parts = {
      lastName: str(body.lastName),
      firstName: str(body.firstName),
      middleName: str(body.middleName),
    };
    if (parts.lastName || parts.firstName) {
      const wanted = composeFullName(parts);
      if (wanted !== composeFullName(user)) {
        patch.lastName = parts.lastName;
        patch.firstName = parts.firstName;
        patch.middleName = parts.middleName || null;
        fields.push("fullName");
      }
    }
  } else if (Object.hasOwn(body, "fullName")) {
    const wanted = str(body.fullName);
    if (wanted && wanted !== composeFullName(user)) {
      const parts = splitFullName(wanted);
      patch.lastName = parts.lastName;
      patch.firstName = parts.firstName;
      patch.middleName = parts.middleName || null;
      fields.push("fullName");
      nameGuessed = true;
    }
  }

  return { patch, fields, nameGuessed };
}

async function syncAccount(userId, body = {}) {
  if (!userId || !mongoose.isValidObjectId(userId)) return { status: "skipped" };

  const User = mongoose.model("user");

  try {
    const user = await User.findById(userId)
      .select("firstName lastName middleName email phone passportSeria passportNumber")
      .lean();
    if (!user) return { status: "skipped", reason: "account not found" };

    const { patch, fields, nameGuessed } = buildAccountPatch(body, user);
    if (fields.length === 0) return { status: "unchanged" };

    await User.updateOne({ _id: user._id }, { $set: patch });
    return { status: "synced", fields, nameGuessed };
  } catch (err) {
    winston.error(
      `[4.5] accountSync: akkauntni yangilab bo'lmadi user=${userId} — ${err.message}`,
    );
    return { status: "failed", reason: err.message };
  }
}

const GAP_FIELDS = [
  "lastName",
  "firstName",
  "middleName",
  "email",
  "phone",
  "passportSeria",
  "passportNumber",
];

const FIELD_LABEL = {
  lastName: "Familiya",
  firstName: "Ism",
  middleName: "Otasining ismi",
  email: "Email",
  phone: "Telefon",
  passportSeria: "Pasport seriyasi",
  passportNumber: "Pasport raqami",
};

const isEmpty = (v) => v === null || v === undefined || str(v) === "";

function buildGapPatch(incoming = {}, account = {}) {
  const patch = {};
  const filled = [];
  const conflicts = [];

  for (const key of GAP_FIELDS) {
    const next = str(incoming[key]);
    if (next === "") continue;

    if (isEmpty(account[key])) {
      patch[key] = next;
      filled.push(key);
    } else if (str(account[key]) !== next) {
      conflicts.push({ field: key, account: account[key], incoming: next });
    }
  }

  return { patch, filled, conflicts };
}

function conflictWarnings(conflicts) {
  return conflicts.map(
    (c) =>
      `${FIELD_LABEL[c.field] || c.field}: akkauntda "${c.account}", ro'yxatda "${c.incoming}" — ` +
      "akkaunt TEGILMADI, qaysi biri to'g'ri ekanini tekshiring",
  );
}

async function fillAccountGaps(userId, incoming = {}, { dryRun = false } = {}) {
  const none = { status: "skipped", filled: [], conflicts: [], warnings: [] };
  if (!userId || !mongoose.isValidObjectId(userId)) return none;

  const User = mongoose.model("user");

  try {
    const account = await User.findById(userId).select(GAP_FIELDS.join(" ")).lean();
    if (!account) return none;

    const { patch, filled, conflicts } = buildGapPatch(incoming, account);
    const warnings = conflictWarnings(conflicts);

    if (filled.length === 0) {
      return { status: "unchanged", filled, conflicts, warnings };
    }

    if (!dryRun) await User.updateOne({ _id: account._id }, { $set: patch });

    warnings.push(
      `Akkauntning bo'sh maydonlari to'ldirildi: ${filled.map((f) => FIELD_LABEL[f] || f).join(", ")}`,
    );
    return { status: "filled", filled, conflicts, warnings };
  } catch (err) {
    winston.error(
      `[4.5] fillAccountGaps: akkauntni to'ldirib bo'lmadi user=${userId} — ${err.message}`,
    );
    return {
      status: "failed",
      filled: [],
      conflicts: [],
      warnings: [`Akkaunt ma'lumotini to'ldirib bo'lmadi: ${err.message}`],
    };
  }
}

async function syncAccountRole(userId, program) {
  if (!userId || !mongoose.isValidObjectId(userId)) return { status: "skipped" };

  const User = mongoose.model("user");

  try {
    const user = await User.findById(userId)
      .select("_id role")
      .populate({ path: "role", select: "title permissions" })
      .lean();
    if (!user) return { status: "skipped", reason: "account not found" };

    if (!roleMatches(user.role, RESIDENT_STUDENT)) {
      return {
        status: "blocked",
        from: user.role?.title || null,
        reason:
          `Akkaunt talaba toifasida emas (${user.role?.title || "rolsiz"}) — roli o'zgartirilmadi`,
      };
    }

    const role = await resolveResidentRole(program);
    if (!role.id) {
      return {
        status: "failed",
        reason:
          role.ambiguous > 1
            ? `"${program}" uchun rol aniqlanmadi — ruxsat profiliga ${role.ambiguous} ta rol mos keldi`
            : `"${role.title || program}" roli ma'lumotlar bazasida yo'q (seed ishga tushirilsin)`,
      };
    }

    const from = user.role?.title || null;
    if (String(user.role?._id || user.role) === String(role.id)) {
      return { status: "unchanged", from };
    }

    await User.updateOne({ _id: user._id }, { $set: { role: role.id } });
    return { status: "synced", from, to: ROLE_BY_PROGRAM[program] || null };
  } catch (err) {
    winston.error(
      `[4.5] syncAccountRole: rolni yangilab bo'lmadi user=${userId} — ${err.message}`,
    );
    return { status: "failed", reason: err.message };
  }
}

module.exports = {
  syncAccount,
  syncAccountRole,
  buildAccountPatch,
  DIRECT_FIELDS,
  fillAccountGaps,
  buildGapPatch,
  GAP_FIELDS,
};
