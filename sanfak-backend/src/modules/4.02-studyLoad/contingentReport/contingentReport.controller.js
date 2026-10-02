"use strict";

const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");
const {
  resolveAcademicYearId,
  getAcademicYearTitle,
} = require("#references/_services/academicYearResolver");
const FacultyModel = require("#references/faculty/faculty.model");
const {
  buildChainVisibilityFilter,
  andFilters,
  VISIBILITY_BYPASS,
} = require("#modules/4.02-studyLoad/_shared/chainVisibility");
const {
  issueToken,
} = require("#modules/4.02-studyLoad/_verify/documentVerify.service");
const { runFinalRevoke } = require("#modules/4.02-studyLoad/_shared/finalStepRevoke");
const {
  buildSummary,
} = require("#modules/4.02-studyLoad/_services/contingentSummary");
const {
  buildContingentReportPdf,
} = require("#modules/4.02-studyLoad/_pdf/contingentReport.pdf");
const {
  buildContingentWorkbook,
  contingentFileName,
} = require("#modules/4.02-studyLoad/_excel/contingentReport.xlsx");

const service = require("./contingentReport.service");
const ContingentReport = require("./contingentReport.model");

const ENTITY_KEY = "contingentReport";

const wrapErr = (err, message) =>
  err.statusCode ? err : new ErrorHandler(400, message, err.message);

const readFilter = (req) =>
  andFilters(
    req.scope || {},
    buildChainVisibilityFilter(ENTITY_KEY, req.user?.role?.title, {
      userId: req.user?._id,
    }),
  );

const writeFilter = (req) => {
  const faculty = req.scope?.faculty;
  if (!faculty) {
    if (VISIBILITY_BYPASS.includes(req.user?.role?.title)) return { active: true };
    throw new ErrorHandler(
      403,
      "Hisobotni faqat o'z fakulteti doirasidagi foydalanuvchi o'zgartira oladi",
    );
  }
  return { active: true, faculty };
};

const actionContext = (req) => ({
  userRole: req.user?.role?.title,
  userId: req.user?._id,
  protocol: req.body?.protocol,
  signature: req.body?.signature,
  eri: req.eri,
  eriSignature: req.body?.eriSignature,
  eriSerial: req.body?.eriSerial,
});

const loadForExport = (id, filter) =>
  ContingentReport.findOne({ _id: id, active: true, ...filter })
    .populate({
      path: "approvalSteps.approvedBy",
      select: "firstName lastName middleName",
    })
    .lean();

async function resolveFacultyForCreate(req) {
  const facultyId = req.scope?.faculty;
  if (!facultyId) {
    throw new ErrorHandler(
      403,
      "Hisobot faqat fakultet darajasidagi foydalanuvchi tomonidan tuziladi",
    );
  }
  const faculty = await FacultyModel.findById(facultyId).select("title").lean();
  if (!faculty) throw new ErrorHandler(404, "Fakultet topilmadi");
  return faculty;
}

async function runSubmit(doc, ctx, res) {
  service.submitReport(doc, ctx);
  await doc.save();
  return res.status(200).json({
    message: "Hisobot dekan tasdig'iga yuborildi",
    action: "submitted",
    status: doc.status,
    nextStep: service.getCurrentStep(doc.approvalSteps)?.step || null,
  });
}

async function runReopen(doc, ctx, res) {
  service.reopenReport(doc, ctx);
  await doc.save();
  return res.status(200).json({
    message: "Hisobot qayta ochildi",
    action: "reopened",
    status: doc.status,
  });
}

async function runApproveStep(doc, ctx, res) {
  const { approvedStep, nextStep } = service.approveStep(doc, ctx);

  if (doc.status === "approved") {
    try {
      await issueToken(doc, ctx.userId || null);
    } catch (err) {
      winston.error(`[ContingentReport] QR token yaratishda xato: ${err.message}`);
    }
  }
  await doc.save();

  return res.status(200).json({
    message: `'${approvedStep}' bosqichi tasdiqlandi`,
    action: doc.status === "approved" ? "approved" : "approved_step",
    approvedStep,
    nextStep,
    status: doc.status,
  });
}

async function loadSummary(query) {
  const ayId = await resolveAcademicYearId(query.academicYear);
  if (!ayId) throw new ErrorHandler(400, "O'quv yili topilmadi");
  const [reports, faculties, academicYearTitle] = await Promise.all([
    service.loadApprovedReports(ayId),
    service.listActiveFaculties(),
    getAcademicYearTitle(ayId),
  ]);
  return {
    academicYearTitle: academicYearTitle || "",
    approvedCount: reports.length,
    asOfDate: service.summaryAsOfDate(reports),
    summary: buildSummary({ reports, faculties }),
  };
}

const sendXlsx = async (res, wb, fileName) => {
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  await wb.xlsx.write(res);
  return res.end();
};

const sendPdf = (res, pdf, fileName) => {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  pdf.pipe(res);
  pdf.end();
  return undefined;
};

module.exports = {
  addContingentReport: async (req, res, next) => {
    try {
      const faculty = await resolveFacultyForCreate(req);
      const ayId = await resolveAcademicYearId(req.body.academicYear);
      if (!ayId) return next(new ErrorHandler(400, "O'quv yili topilmadi"));
      const academicYearTitle = await getAcademicYearTitle(ayId);

      const { doc, meta } = await service.createReport({
        facultyId: faculty._id,
        facultyTitle: faculty.title,
        academicYearId: ayId,
        academicYearTitle,
        asOfDate: req.body.asOfDate,
        userId: req.user?._id,
      });
      return res.status(201).json({
        message: "Kontingent hisoboti tuzildi",
        data: service.toPublicDoc(doc),
        meta,
      });
    } catch (err) {
      return next(wrapErr(err, "Hisobot tuzishda xatolik"));
    }
  },

  paginateContingentReports: async (req, res, next) => {
    try {
      const query = { ...req.query };
      if (query.academicYear) {
        const ayId = await resolveAcademicYearId(query.academicYear);
        if (!ayId) return next(new ErrorHandler(400, "O'quv yili topilmadi"));
        query.academicYear = ayId;
      }
      const data = await service.paginateReports(query, readFilter(req));
      return res.status(200).json(data);
    } catch (err) {
      return next(wrapErr(err, "Hisobotlar ro'yxatini olishda xatolik"));
    }
  },

  getSummary: async (req, res, next) => {
    try {
      const data = await loadSummary(req.query);
      return res.status(200).json({ data });
    } catch (err) {
      return next(wrapErr(err, "Yig'ma hisobotni olishda xatolik"));
    }
  },

  exportSummaryPdf: async (req, res, next) => {
    try {
      const { academicYearTitle, summary, asOfDate } = await loadSummary(req.query);
      const pdf = await buildContingentReportPdf({
        variant: "institute",
        academicYearTitle,
        asOfDate,
        summary,
      });
      return sendPdf(
        res,
        pdf,
        contingentFileName({ academicYearTitle, ext: "pdf" }),
      );
    } catch (err) {
      return next(wrapErr(err, "Yig'ma PDF yaratishda xatolik"));
    }
  },

  exportSummaryXlsx: async (req, res, next) => {
    try {
      const { academicYearTitle, summary, asOfDate } = await loadSummary(req.query);
      const wb = buildContingentWorkbook({
        variant: "institute",
        academicYearTitle,
        asOfDate,
        summary,
      });
      return await sendXlsx(res, wb, contingentFileName({ academicYearTitle, ext: "xlsx" }));
    } catch (err) {
      return next(wrapErr(err, "Yig'ma Excel yaratishda xatolik"));
    }
  },

  findOneContingentReport: async (req, res, next) => {
    try {
      const doc = await service.findReportById(req.params.id, readFilter(req));
      if (!doc) return res.status(404).json({ message: "Hisobot topilmadi" });
      const currentStep = service.getCurrentStep(doc.approvalSteps)?.step || null;
      return res.status(200).json({ data: { ...doc, currentStep } });
    } catch (err) {
      return next(wrapErr(err, "Hisobotni olishda xatolik"));
    }
  },

  updateContingentReport: async (req, res, next) => {
    try {
      const doc = await ContingentReport.findOne({ _id: req.params.id, ...writeFilter(req) });
      if (!doc) return res.status(404).json({ message: "Hisobot topilmadi" });
      await service.applyContent(doc, req.body);
      await doc.save();
      return res
        .status(200)
        .json({ message: "Hisobot saqlandi", data: service.toPublicDoc(doc) });
    } catch (err) {
      return next(wrapErr(err, "Hisobotni saqlashda xatolik"));
    }
  },

  prefillContingentReport: async (req, res, next) => {
    try {
      const doc = await ContingentReport.findOne({ _id: req.params.id, ...writeFilter(req) });
      if (!doc) return res.status(404).json({ message: "Hisobot topilmadi" });
      const result = await service.applyPrefill(doc, { force: !!req.body?.force });
      await doc.save();
      return res.status(200).json({
        message: `Tizimdan to'ldirildi: ${result.updated} qator yangilandi, ${result.added} qator qo'shildi`,
        data: service.toPublicDoc(doc),
        meta: { ...result.meta, updated: result.updated, added: result.added, skippedManual: result.skippedManual },
      });
    } catch (err) {
      return next(wrapErr(err, "Tizimdan to'ldirishda xatolik"));
    }
  },

  approveContingentReport: async (req, res, next) => {
    try {
      const doc = await ContingentReport.findOne({ _id: req.params.id, ...writeFilter(req) });
      if (!doc) return res.status(404).json({ message: "Hisobot topilmadi" });
      const ctx = actionContext(req);
      if (doc.status === "draft") return await runSubmit(doc, ctx, res);
      if (doc.status === "rejected") return await runReopen(doc, ctx, res);
      return await runApproveStep(doc, ctx, res);
    } catch (err) {
      return next(wrapErr(err, "Hisobotni tasdiqlashda xatolik"));
    }
  },

  rejectContingentReport: async (req, res, next) => {
    try {
      const doc = await ContingentReport.findOne({ _id: req.params.id, ...writeFilter(req) });
      if (!doc) return res.status(404).json({ message: "Hisobot topilmadi" });
      if (doc.status === "approved") {
        return await runFinalRevoke({ entity: "contingentReport", doc, req, res, next });
      }
      const { rejectedStep } = service.rejectReport(doc, {
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

  exportReportPdf: async (req, res, next) => {
    try {
      const doc = await loadForExport(req.params.id, readFilter(req));
      if (!doc) return res.status(404).json({ message: "Hisobot topilmadi" });
      const pdf = await buildContingentReportPdf({
        variant: "faculty",
        doc,
        academicYearTitle: doc.academicYearTitle,
        asOfDate: doc.asOfDate || doc.createdAt,
        summary: buildSummary({ reports: [doc] }),
      });
      return sendPdf(
        res,
        pdf,
        contingentFileName({ academicYearTitle: doc.academicYearTitle, facultyTitle: doc.facultyTitle, ext: "pdf" }),
      );
    } catch (err) {
      return next(wrapErr(err, "PDF yaratishda xatolik"));
    }
  },

  exportReportXlsx: async (req, res, next) => {
    try {
      const doc = await loadForExport(req.params.id, readFilter(req));
      if (!doc) return res.status(404).json({ message: "Hisobot topilmadi" });
      const wb = buildContingentWorkbook({
        variant: "faculty",
        doc,
        academicYearTitle: doc.academicYearTitle,
        asOfDate: doc.asOfDate || doc.createdAt,
        summary: buildSummary({ reports: [doc] }),
        signatories: service.buildSignatories(doc),
      });
      return await sendXlsx(
        res,
        wb,
        contingentFileName({ academicYearTitle: doc.academicYearTitle, facultyTitle: doc.facultyTitle, ext: "xlsx" }),
      );
    } catch (err) {
      return next(wrapErr(err, "Excel yaratishda xatolik"));
    }
  },

  deleteContingentReport: async (req, res, next) => {
    try {
      const { active: _active, ...scopeOnly } = writeFilter(req);
      const doc = await service.removeReport(req.params.id, scopeOnly);
      if (!doc) return res.status(404).json({ message: "Hisobot topilmadi" });
      return res.status(200).json({ message: "Hisobot o'chirildi" });
    } catch (err) {
      return next(wrapErr(err, "Hisobotni o'chirishda xatolik"));
    }
  },
};
