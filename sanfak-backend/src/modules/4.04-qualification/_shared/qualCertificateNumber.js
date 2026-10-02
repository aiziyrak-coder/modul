"use strict";

const QualEarnedCertificate = require("./qualEarnedCertificate.model");
const QualCertificateCounter = require("./qualCertificateCounter.model");

const PAD_NUMBER = 5;
const PAD_REG = 6;

const REG_COUNTER = "reg";
const seriesCounter = (template) => "series:" + Number(template || 1);
const REF_COUNTER = "series:ref";

function pad(n, width) {
  return String(n).padStart(width, "0");
}

async function currentMax(field, filter) {
  const last = await QualEarnedCertificate.findOne({
    ...filter,
    [field]: { $type: "string" },
  })
    .sort({ [field]: -1 })
    .select(field)
    .lean();
  return Number((last && last[field]) || 0);
}

async function nextValue(counterId, seedFn) {
  const exists = await QualCertificateCounter.exists({ _id: counterId });
  if (!exists) {
    await QualCertificateCounter.updateOne(
      { _id: counterId },
      { $setOnInsert: { seq: await seedFn() } },
      { upsert: true },
    );
  }
  const doc = await QualCertificateCounter.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  ).lean();
  return doc.seq;
}

async function nextSeriesNumber(template) {
  const seq = await nextValue(seriesCounter(template), () =>
    currentMax("number", { kind: 1, template }),
  );
  return pad(seq, PAD_NUMBER);
}

async function nextReferenceNumber() {
  const seq = await nextValue(REF_COUNTER, () => currentMax("number", { kind: 2 }));
  return pad(seq, PAD_NUMBER);
}

async function nextRegNumber() {
  const seq = await nextValue(REG_COUNTER, () => currentMax("regNumber", {}));
  return pad(seq, PAD_REG);
}

async function createNumberedCertificate({ course, listener, kind, template }) {
  if (kind !== 1) {
    return QualEarnedCertificate.create({
      course,
      listener,
      kind,
      number: await nextReferenceNumber(),
    });
  }
  const [number, regNumber] = await Promise.all([
    nextSeriesNumber(template),
    nextRegNumber(),
  ]);
  return QualEarnedCertificate.create({
    course,
    listener,
    kind,
    template,
    number,
    regNumber,
  });
}

module.exports = {
  nextReferenceNumber,
  nextSeriesNumber,
  nextRegNumber,
  createNumberedCertificate,
  REG_COUNTER,
  seriesCounter,
};
