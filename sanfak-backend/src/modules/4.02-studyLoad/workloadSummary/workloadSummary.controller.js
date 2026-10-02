"use strict";

const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");
const {
  resolveAcademicYearId,
  getAcademicYearTitle,
} = require("#references/_services/academicYearResolver");
const {
  issueToken,
} = require("#modules/4.02-studyLoad/_verify/documentVerify.service");
const { runFinalRevoke } = require("#modules/4.02-studyLoad/_shared/finalStepRevoke");
const {
  buildWorkloadSummaryWorkbook,
  summaryFileName,
} = require("#modules/4.02-studyLoad/_excel/workloadSummary.xlsx");
const {
  buildWorkloadSummaryPdf,
} = require("#modules/4.02-studyLoad/_pdf/workloadSummary.pdf");

const service = require("./workloadSummary.service");
const WorkloadSummary = require("./workloadSummary.model");
const { REVOCABLE_STATUSES } = require("./workloadSummary.chain");

const viewerOf = (req) => ({
  userRole: req.user?.role?.title,
  userId: req.user?._id,
});

const loadForExport = (id, viewer) =>
  WorkloadSummary.findOne(service.readFilter(id, viewer))
    .populate({
      path: "approvalSteps.approvedBy",
      select: "firstName lastName middleName",
    })
    .lean();

const wrapErr = (err, message) =>
  err.statusCode ? err : new ErrorHandler(400, message, err.message);

const actionContext = (req) => ({
  userRole: req.user?.role?.title,
  userId: req.user?._id,
  signature: req.body?.signature,
  eri: req.eri,
  eriSignature: req.body?.eriSignature,
  eriSerial: req.body?.eriSerial,
});

async function runSubmit(doc, ctx, res) {
  service.submitSummary(doc, ctx);
  await doc.save();
  return res.status(200).json({
    message: "Hisobot ko'rib chiqishga yuborildi",
    action: "submitted",
    status: doc.status,
    nextStep: service.getCurrentStep(doc.approvalSteps)?.step || null,
  });
}

async function runReopen(doc, ctx, res) {
  service.reopenSummary(doc, ctx);
  await doc.save();
  return res.status(200).json({
    message: "Hisobot qayta ochildi",
    action: "reopened",
    status: doc.status,
  });
}

async function runApproveStep(doc, ctx, res) {
  const { approvedStep, nextStep } = service.approveStep(doc, ctx);

  if (doc.status === "approved") await service.assertFreshForFinalApproval(doc);

  if (doc.status === "approved") {
    try {
      await issueToken(doc, ctx.userId || null);
    } catch (err) {
      winston.error(`[WorkloadSummary] QR token yaratishda xato: ${err.message}`);
    }
  }

  await doc.save();

  const superseded =
    doc.status === "approved" ? await service.supersedePrevious(doc) : 0;

  return res.status(200).json({
    message: `'${approvedStep}' bosqichi tasdiqlandi`,
    action: doc.status === "approved" ? "approved" : "approved_step",
    approvedStep,
    nextStep,
    status: doc.status,
    superseded,
  });
}

module.exports = {
  addWorkloadSummary: async (req, res, next) => {
    try {
      const ayId = await resolveAcademicYearId(req.body.academicYear);
      if (!ayId) return next(new ErrorHandler(400, "O'quv yili topilmadi"));

      const academicYearTitle = await getAcademicYearTitle(ayId);
      const doc = await service.createSummary({
        academicYearId: ayId,
        academicYearTitle,
        userId: req.user?._id,
      });

      return res.status(201).json({
        message: "Kafedralar soatlar hisobi tuzildi",
        data: doc,
      });
    } catch (err) {
      return next(wrapErr(err, "Hisobot tuzishda xatolik"));
    }
  },

  paginateWorkloadSummaries: async (req, res, next) => {
    try {
      const query = { ...req.query };
      if (query.academicYear) {
        const ayId = await resolveAcademicYearId(query.academicYear);
        if (!ayId) return next(new ErrorHandler(400, "O'quv yili topilmadi"));
        query.academicYear = ayId;
      }
      const data = await service.paginateSummaries(query, viewerOf(req));
      return res.status(200).json(data);
    } catch (err) {
      return next(wrapErr(err, "Hisobotlar ro'yxatini olishda xatolik"));
    }
  },

  findOneWorkloadSummary: async (req, res, next) => {
    try {
      const doc = await service.findSummaryById(req.params.id, viewerOf(req));
      if (!doc) return res.status(404).json({ message: "Hisobot topilmadi" });

      const staleness = await service.computeStaleness(doc);
      return res.status(200).json({ data: { ...doc, staleness } });
    } catch (err) {
      return next(wrapErr(err, "Hisobotni olishda xatolik"));
    }
  },

  approveWorkloadSummary: async (req, res, next) => {
    try {
      const doc = await WorkloadSummary.findOne({
        _id: req.params.id,
        active: true,
      });
      if (!doc) return res.status(404).json({ message: "Hisobot topilmadi" });

      const ctx = actionContext(req);
      if (doc.status === "draft") return await runSubmit(doc, ctx, res);
      if (doc.status === "rejected") return await runReopen(doc, ctx, res);
      return await runApproveStep(doc, ctx, res);
    } catch (err) {
      return next(wrapErr(err, "Hisobotni tasdiqlashda xatolik"));
    }
  },

  rejectWorkloadSummary: async (req, res, next) => {
    try {
      const doc = await WorkloadSummary.findOne({
        _id: req.params.id,
        active: true,
      });
      if (!doc) return res.status(404).json({ message: "Hisobot topilmadi" });
      if (REVOCABLE_STATUSES.includes(doc.status)) {
        return await runFinalRevoke({
          entity: "workloadSummary",
          doc,
          req,
          res,
          next,
          revocableStatuses: REVOCABLE_STATUSES,
        });
      }

      const { rejectedStep } = service.rejectSummary(doc, {
        userRole: req.user?.role?.title,
        userId: req.user?._id,
        comment: req.body?.comment,
      });
      await doc.save();

      return res.status(200).json({
        message: `'${rejectedStep}' bosqichida rad etildi`,
        action: "rejected",
        rejectedStep,
        status: doc.status,
      });
    } catch (err) {
      return next(wrapErr(err, "Hisobotni rad etishda xatolik"));
    }
  },

  exportSummaryXlsx: async (req, res, next) => {
    try {
      const doc = await loadForExport(req.params.id, viewerOf(req));
      if (!doc) return res.status(404).json({ message: "Hisobot topilmadi" });

      const wb = buildWorkloadSummaryWorkbook({
        rows: doc.snapshot?.rows || [],
        academicYearTitle: doc.academicYearTitle || "",
        date: doc.snapshot?.generatedAt || doc.createdAt,
        signatories: service.buildSignatories(doc),
      });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${summaryFileName(doc.academicYearTitle)}"`,
      );
      await wb.xlsx.write(res);
      return res.end();
    } catch (err) {
      return next(wrapErr(err, "Excel jadvalini yaratishda xatolik"));
    }
  },

  exportSummaryPdf: async (req, res, next) => {
    try {
      const doc = await loadForExport(req.params.id, viewerOf(req));
      if (!doc) return res.status(404).json({ message: "Hisobot topilmadi" });

      const pdf = await buildWorkloadSummaryPdf(doc);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${summaryFileName(doc.academicYearTitle).replace(/\.xlsx$/, ".pdf")}"`,
      );
      pdf.pipe(res);
      pdf.end();
      return undefined;
    } catch (err) {
      return next(wrapErr(err, "PDF yaratishda xatolik"));
    }
  },

  deleteWorkloadSummary: async (req, res, next) => {
    try {
      const doc = await service.removeDraft(req.params.id, viewerOf(req));
      if (!doc) return res.status(404).json({ message: "Hisobot topilmadi" });
      return res.status(200).json({ message: "Hisobot o'chirildi" });
    } catch (err) {
      return next(wrapErr(err, "Hisobotni o'chirishda xatolik"));
    }
  },
};
