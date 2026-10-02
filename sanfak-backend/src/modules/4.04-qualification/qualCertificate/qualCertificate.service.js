"use strict";

const QualEarnedCertificate = require("#modules/4.04-qualification/_shared/qualEarnedCertificate.model");
const { saveSertifikatPdf } = require("#modules/4.04-qualification/_pdf/sertifikat.pdf");
const {
  saveMalumotnomaPdf,
} = require("#modules/4.04-qualification/_pdf/malumotnoma.pdf");
const winston = require("#shared/winston.logger");

const STATUS = {
  PENDING: 1,
  APPROVED: 2,
  REJECTED: 3,
};

const isReleased = (cert) => Boolean(cert) && cert.status === STATUS.APPROVED;

async function buildDocument(cert, reqBase) {
  return cert.kind === 1
    ? saveSertifikatPdf(cert._id, reqBase)
    : saveMalumotnomaPdf(cert._id, reqBase);
}

async function approveMany(ids, userId, reqBase) {
  const approved = [];
  const failed = [];

  for (const id of ids) {
    try {
       
      const cert = await QualEarnedCertificate.findById(id);
      if (!cert) {
        failed.push({ id: String(id), message: "Yozuv topilmadi" });
        continue;
      }
      if (cert.status === STATUS.APPROVED) {
        approved.push(String(id));
        continue;
      }

      cert.status = STATUS.APPROVED;
      cert.approvedBy = userId;
      cert.approvedAt = new Date();
      cert.rejectReason = undefined;
       
      await cert.save();

      await buildDocument(cert, reqBase);
      approved.push(String(id));
    } catch (err) {
      winston.error(`[QualCertificate] tasdiqlashda xato (${id}): ${err.message}`);
      failed.push({ id: String(id), message: err.message });
    }
  }

  return { approved, failed };
}

async function rejectMany(ids, userId, reason) {
  const res = await QualEarnedCertificate.updateMany(
    { _id: { $in: ids } },
    {
      $set: {
        status: STATUS.REJECTED,
        approvedBy: userId,
        approvedAt: new Date(),
        rejectReason: reason || "",
      },
      $unset: { file: "" },
    },
  );
  return { rejected: res.modifiedCount };
}

module.exports = {
  STATUS,
  isReleased,
  buildDocument,
  approveMany,
  rejectMany,
};
