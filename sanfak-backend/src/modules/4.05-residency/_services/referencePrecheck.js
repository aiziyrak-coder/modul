"use strict";

const mongoose = require("mongoose");
const winston = require("#shared/winston.logger");

const CURRICULUM_DEFAULT_FORM = "kunduzgi";

const db = () => {
  if (!mongoose.connection.db) throw new Error("ulanish hali ochilmagan");
  return mongoose.connection.db;
};

const key = (s) =>
  String(s ?? "")
    .trim()
    .toLowerCase();

const checkEducationFormDefault = async () => {
  const rows = await db()
    .collection("educationforms")
    .find({}, { projection: { title: 1 } })
    .toArray();

  if (!rows.length) return { ok: false, reason: "ma'lumotnoma BO'SH" };

  const found = rows.some((r) => key(r.title) === key(CURRICULUM_DEFAULT_FORM));
  return found
    ? { ok: true }
    : {
        ok: false,
        reason: `mavjudlari: ${rows.map((r) => r.title).join(", ")}`,
      };
};

const checkAcademicYears = async () => {
  const count = await db().collection("academicyears").countDocuments();
  return count > 0 ? { ok: true } : { ok: false, reason: "ma'lumotnoma BO'SH" };
};

const runPrecheck = async () => {
  try {
    const form = await checkEducationFormDefault();
    if (!form.ok) {
      winston.warn(
        `[4.5 precheck] "${CURRICULUM_DEFAULT_FORM}" ta'lim shakli ` +
          `ma'lumotnomada YO'Q (${form.reason}). Ta'lim shakli ko'rsatilmagan ` +
          "o'quv rejasi YARATILMAYDI — `educationForm` ma'lumotnomasiga o'sha " +
          "qatorni qaytaring yoki modeldagi default'ni o'zgartiring.",
      );
    }

    const years = await checkAcademicYears();
    if (!years.ok) {
      winston.warn(
        "[4.5 precheck] `academicYear` ma'lumotnomasi bo'sh — o'quv yili " +
          "pikerlari va hisobot filtri bo'sh keladi.",
      );
    }
  } catch (err) {
    winston.warn(`[4.5 precheck] tekshirib bo'lmadi: ${err.message}`);
  }
};

const registerReferencePrecheck = () => {
  if (mongoose.connection.readyState === 1) {
    runPrecheck();
    return;
  }
  mongoose.connection.once("connected", runPrecheck);
};

module.exports = {
  CURRICULUM_DEFAULT_FORM,
  checkEducationFormDefault,
  checkAcademicYears,
  runPrecheck,
  registerReferencePrecheck,
};
