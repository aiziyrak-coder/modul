"use strict";

const GiftedStudentModel = require("#modules/4.11-giftedStudent/giftedStudent/giftedStudent.model");
const { checkGroupDirection } = require("./hierarchyCheck");
const {
  resolveNameParts,
  provisionAccount,
  discardAccount,
} = require("./studentAccount");
const { fillAccountGaps } = require("./accountSync");

const str = (v) => (typeof v === "string" ? v.trim() : "");

const IDENTITY_KEYS = ["jshshir", "passportSeria", "passportNumber"];
const normalizeIdentity = (body) => {
  const out = { ...body };
  IDENTITY_KEYS.forEach((k) => {
    if (typeof out[k] !== "string") return;
    const trimmed = out[k].trim();
    out[k] = trimmed === "" ? null : trimmed;
  });
  return out;
};

const sameId = (a, b) => String(a || "") === String(b || "");

function conflictMessage(existing, body, accountUserId) {
  const name = str(existing.fullName) || "nomsiz yozuv";
  if (str(body.jshshir) && sameId(existing.jshshir, str(body.jshshir))) {
    return `Bu JSHSHIR allaqachon ro'yxatda: "${name}". Yangi talaba yaratilmadi — mavjud yozuvni tahrirlang.`;
  }
  if (
    str(body.passportSeria) &&
    str(body.passportNumber) &&
    sameId(existing.passportSeria, str(body.passportSeria)) &&
    sameId(existing.passportNumber, str(body.passportNumber))
  ) {
    return `Bu pasport allaqachon ro'yxatda: "${name}". Yangi talaba yaratilmadi — mavjud yozuvni tahrirlang.`;
  }
  if (accountUserId && sameId(existing.user, accountUserId)) {
    return `Bu platforma akkaunti allaqachon "${name}" yozuviga biriktirilgan. Yangi talaba yaratilmadi.`;
  }
  return `Bunday talaba allaqachon ro'yxatda: "${name}". Yangi talaba yaratilmadi.`;
}

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

async function onboardStudent(
  rawBody = {},
  { dryRun = false, conflictIsError = false } = {},
) {
  const warnings = [];
  const body = normalizeIdentity(rawBody);

  const clash = await checkGroupDirection(body);
  if (clash) {
    return { ok: false, errors: [clash.message], warnings, account: null, student: null };
  }

  const parts = resolveNameParts(body);
  if (!parts.fullName) {
    return {
      ok: false,
      errors: ["F.I.SH bo'sh — talaba yozuvi yaratilmadi"],
      warnings,
      account: null,
      student: null,
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
    ? await GiftedStudentModel.findOne(dupQuery)
        .select("_id user fullName jshshir passportSeria passportNumber")
        .lean()
    : null;

  if (existing) {
    if (conflictIsError) {
      await releaseAccount(
        "Ziddiyat sababli shu so'rovda yaratilgan akkaunt o'chirildi",
      );
      return {
        ok: false,
        errors: [conflictMessage(existing, body, account.userId)],
        warnings,
        fullName: parts.fullName,
        account: null,
        student: null,
      };
    }

    if (!existing.user && (account.userId || dryRun)) {
      if (!dryRun) {
        await GiftedStudentModel.updateOne(
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
        student: { status: "linked", id: existing._id },
      };
    }

    if (existing.user && account.userId && !sameId(existing.user, account.userId)) {
      await releaseAccount(
        "Talaba allaqachon BOSHQA platforma akkauntiga bog'langan — yangi akkaunt yaratilmadi",
      );
    } else if (existing.user) {
      account = { status: account.status, userId: account.userId, createdHere: false };
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
      student: { status: "existing", id: existing._id },
    };
  }

  try {
    const doc = dryRun
      ? { _id: null }
      : await new GiftedStudentModel({
          ...body,
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
      student: { status: "created", id: doc._id },
    };
  } catch (err) {
    await releaseAccount(
      "Talaba yozuvi saqlanmadi — shu so'rovda yaratilgan akkaunt o'chirildi",
    );
    throw err;
  }
}

module.exports = { onboardStudent, duplicateQuery };
