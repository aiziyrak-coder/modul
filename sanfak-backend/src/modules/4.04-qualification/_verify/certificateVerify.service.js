"use strict";

const QualEarnedCertificate = require("#modules/4.04-qualification/_shared/qualEarnedCertificate.model");
require("#modules/4.04-qualification/qualCourse/qualCourse.model");
require("#modules/4.04-qualification/qualCourseType/qualCourseType.model");
require("#modules/4.04-qualification/_shared/qualListener.model");

const {
  SERIES,
  REFERENCE_PREFIX,
} = require("#modules/4.04-qualification/_shared/certificateCode");

const SERIES_PREFIXES = [
  ...Object.entries(SERIES).map(([template, prefix]) => ({
    template: Number(template),
    prefix,
    reference: false,
  })),
  { template: null, prefix: REFERENCE_PREFIX, reference: true },
].sort((a, b) => b.prefix.length - a.prefix.length);

function parseCode(raw) {
  const code = String(raw || "").trim().toUpperCase();
  if (!code) return null;
  for (const { template, prefix, reference } of SERIES_PREFIXES) {
    if (code.startsWith(prefix)) {
      const number = code.slice(prefix.length);
      if (number) return { template, prefix, number, reference: Boolean(reference) };
    }
  }
  return null;
}

const STATUS_APPROVED = 2;

async function verifyCertificateByCode(rawCode) {
  const parsed = parseCode(rawCode);
  if (!parsed) return null;

  const candidates = await QualEarnedCertificate.find({
    number: parsed.number,
    kind: parsed.reference ? 2 : 1,
    $or: [{ status: STATUS_APPROVED }, { status: { $exists: false } }],
  })
    .populate({
      path: "course",
      select: "title courseType creditHours form startDate endDate",
      populate: { path: "courseType", select: "template title" },
    })
    .populate({ path: "listener", model: "QualListener", select: "fullName" })
    .lean();

  for (const cert of candidates) {
    const course = cert.course || {};
    const effPrefix = parsed.reference
      ? REFERENCE_PREFIX
      : SERIES[cert.template || (course.courseType && course.courseType.template) || 1] || "I";
    if (effPrefix === parsed.prefix) {
      return {
        code: effPrefix + parsed.number,
        kind: Number(cert.kind) === 2 ? 2 : 1,
        fullName: (cert.listener && cert.listener.fullName) || "",
        courseName: course.title || "",
        courseType: (course.courseType && course.courseType.title) || "",
        creditHours: course.creditHours || null,
        form: course.form || null,
        startDate: course.startDate || null,
        endDate: course.endDate || null,
        issuedAt: cert.createdAt,
      };
    }
  }

  return null;
}

module.exports = { parseCode, verifyCertificateByCode };
