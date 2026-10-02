"use strict";

const Resident = require("#modules/4.05-residency/resident/resident.model");
const {
  resolveNameParts,
  provisionAccount,
  discardAccount,
} = require("./residentAccount");
const { fillAccountGaps } = require("./accountSync");
const {
  applySpecialtyDefaults,
  derivedWarnings,
} = require("./specialtyDefaults");

const str = (v) => (typeof v === "string" ? v.trim() : "");
const sameId = (a, b) => String(a || "") === String(b || "");

function duplicateQuery({ userId, jshshir, passportSeria, passportNumber }) {
  const or = [];
  if (userId) or.push({ user: userId });
  if (str(jshshir)) or.push({ jshshir: str(jshshir) });
  if (str(passportSeria) && str(passportNumber)) {
    or.push({
      passportSeria: str(passportSeria),
      passportNumber: str(passportNumber),
    });
  }
  return or.length ? { $or: or } : null;
}

function duplicateReason(existing, { userId, jshshir, passportSeria, passportNumber }) {
  if (!existing) return null;
  if (userId && sameId(existing.user, userId)) return "user";
  if (str(jshshir) && existing.jshshir === str(jshshir)) return "jshshir";
  if (
    str(passportSeria) &&
    str(passportNumber) &&
    existing.passportSeria === str(passportSeria) &&
    existing.passportNumber === str(passportNumber)
  ) {
    return "passport";
  }
  return null;
}

async function onboardResident(body = {}, { dryRun = false } = {}) {
  const warnings = [];

  const parts = resolveNameParts(body);
  if (!parts.fullName) {
    return {
      ok: false,
      errors: ["F.I.SH bo'sh — kontingent yozuvi yaratilmadi"],
      warnings,
      account: null,
      resident: null,
    };
  }
  if (!str(body.program)) {
    return {
      ok: false,
      errors: ["Ta'lim yo'nalishi (magistratura/ordinatura) ko'rsatilmagan"],
      warnings,
      account: null,
      resident: null,
    };
  }
  if (parts.guessed && parts.firstName) {
    warnings.push(
      `F.I.SH avtomatik bo'lindi: familiya "${parts.lastName}", ism "${parts.firstName}"` +
        (parts.middleName ? `, otasining ismi "${parts.middleName}"` : "") +
        " — tekshiring",
    );
  }

  let account = { status: "skipped", userId: body.user || null, createdHere: false };
  if (!body.user) {
    const provisioned = await provisionAccount({
      jshshir: body.jshshir,
      program: body.program,
      lastName: parts.lastName,
      firstName: parts.firstName,
      middleName: parts.middleName,
      contact: body,
      dryRun,
    });
    warnings.push(...provisioned.warnings);
    account = provisioned;

    if (provisioned.status === "existing") {
      const gaps = await fillAccountGaps(
        provisioned.userId,
        {
          lastName: parts.lastName,
          firstName: parts.firstName,
          middleName: parts.middleName,
          email: body.email,
          phone: body.phone,
          passportSeria: body.passportSeria,
          passportNumber: body.passportNumber,
        },
        { dryRun },
      );
      warnings.push(...gaps.warnings);
      account = { ...account, gaps };
    }
  }

  const releaseAccount = async (reason) => {
    if (!account.createdHere) return;
    warnings.push(reason);
    await discardAccount(account.userId);
    account = { status: "skipped", userId: null, createdHere: false };
  };

  const dupQuery = duplicateQuery({
    userId: account.userId,
    jshshir: body.jshshir,
    passportSeria: body.passportSeria,
    passportNumber: body.passportNumber,
  });

  const existing = dupQuery
    ? await Resident.findOne(dupQuery)
        .select("_id user jshshir passportSeria passportNumber")
        .lean()
    : null;

  const matchedBy = duplicateReason(existing, {
    userId: account.userId,
    jshshir: body.jshshir,
    passportSeria: body.passportSeria,
    passportNumber: body.passportNumber,
  });

  if (existing) {
    if (!existing.user && (account.userId || dryRun)) {
      if (!dryRun) {
        await Resident.updateOne(
          { _id: existing._id },
          { $set: { user: account.userId } },
        );
      }
      return {
        ok: true,
        errors: [],
        warnings,
        fullName: parts.fullName,
        account: {
          status: account.status,
          userId: account.userId,
          ...(account.gaps ? { gaps: account.gaps } : {}),
        },
        resident: { status: "linked", id: existing._id, matchedBy },
      };
    }

    if (existing.user && account.userId && !sameId(existing.user, account.userId)) {
      await releaseAccount(
        "Talaba allaqachon BOSHQA platforma akkauntiga bog'langan — yangi akkaunt yaratilmadi",
      );
    }

    return {
      ok: true,
      errors: [],
      warnings,
      fullName: parts.fullName,
      account: {
        status: account.status,
        userId: account.userId,
        ...(account.gaps ? { gaps: account.gaps } : {}),
      },
      resident: { status: "existing", id: existing._id, matchedBy },
    };
  }

  const withDefaults = await applySpecialtyDefaults(body);
  warnings.push(...derivedWarnings(withDefaults.derived, withDefaults.body));

  try {
    const doc = dryRun
      ? { _id: null }
      : await new Resident({
          ...withDefaults.body,
          fullName: parts.fullName,
          ...(account.userId ? { user: account.userId } : {}),
        }).save();

    return {
      ok: true,
      errors: [],
      warnings,
      fullName: parts.fullName,
      account: {
        status: account.status,
        userId: account.userId,
        ...(account.gaps ? { gaps: account.gaps } : {}),
      },
      resident: { status: "created", id: doc._id },
    };
  } catch (err) {
    await releaseAccount(
      "Kontingent yozuvi saqlanmadi — shu so'rovda yaratilgan akkaunt o'chirildi",
    );
    throw err;
  }
}

module.exports = { onboardResident, duplicateQuery, duplicateReason };
