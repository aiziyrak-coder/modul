"use strict";

const MANUAL_VERIFICATION_PROGRAMS = Object.freeze(["magistratura"]);

const REASONS = Object.freeze({
  samsOnly: "present_requires_sams",
  needsEvidence: "present_requires_verification",
  stateChanged: "state_changed",
});

const MSG = Object.freeze({
  samsOnly:
    "Ordinaturada «Keldi» faqat SAMS ma'lumoti asosida belgilanadi — qo'lda tasdiq qabul qilinmaydi",
  needsEvidence: "Kelganini tasdiqlash uchun SAMS ilovasi yoki qo'lda tasdiq kerak",
  stateChanged: "Yozuv shu orada o'zgardi — sahifani yangilab, qayta urinib ko'ring",
});

const acceptsManualVerification = (program) =>
  MANUAL_VERIFICATION_PROGRAMS.includes(program);

const hasPresenceEvidence = (row) =>
  Boolean(row && (row.samsVerified || row.manualVerified));

function manualVerificationPatch({
  program,
  requested,
  wasVerified = false,
  userId = null,
  now = new Date(),
}) {
  if (!acceptsManualVerification(program) || typeof requested !== "boolean") {
    return {};
  }
  if (requested === false) return { manualVerified: false };
  if (wasVerified) return {};
  return { manualVerified: true, manualVerifiedBy: userId, manualVerifiedAt: now };
}

function presentEvidenceError(status, program, evidence) {
  if (status !== "present" || hasPresenceEvidence(evidence)) return null;
  return acceptsManualVerification(program)
    ? { message: MSG.needsEvidence, reason: REASONS.needsEvidence }
    : { message: MSG.samsOnly, reason: REASONS.samsOnly };
}

function presentEvidenceFilter(update) {
  if (update.manualVerified === true) return {};
  if (update.status !== undefined && update.status !== "present") return {};

  const evidence = [{ samsVerified: true }];
  if (update.manualVerified !== false) evidence.push({ manualVerified: true });
  if (update.status === "present") return { $or: evidence };
  return { $or: [{ status: { $ne: "present" } }, ...evidence] };
}

module.exports = {
  MANUAL_VERIFICATION_PROGRAMS,
  REASONS,
  MSG,
  acceptsManualVerification,
  hasPresenceEvidence,
  manualVerificationPatch,
  presentEvidenceError,
  presentEvidenceFilter,
};
