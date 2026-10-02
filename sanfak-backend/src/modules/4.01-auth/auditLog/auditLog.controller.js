const ExcelJS = require("exceljs");
const { ErrorHandler } = require("#shared/error");
const Service = require("./auditLog.service");
const pdf = require("#shared/pdfGenerators/pdfHelpers");

const fullName = (u) =>
  u ? `${u.lastName || ""} ${u.firstName || ""}`.trim() : "";

module.exports = {
  paginate: async (req, res, next) => {
    try {
      const result = await Service.paginate(req.query);
      return res.status(200).json(result);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Audit jurnalini o'qishda xatolik", err.message),
      );
    }
  },

  modules: async (req, res, next) => {
    try {
      const modules = (await Service.distinctModules())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
      return res.status(200).json(modules);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Modullar ro'yxatini olishda xatolik", err.message),
      );
    }
  },

  exportExcel: async (req, res, next) => {
    try {
      const rows = await Service.listForExport(req.query);

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Audit jurnali");
      ws.columns = [
        { header: "Sana", key: "date", width: 20 },
        { header: "Foydalanuvchi", key: "userName", width: 28 },
        { header: "Modul", key: "module", width: 22 },
        { header: "Metod", key: "method", width: 10 },
        { header: "Yo'l", key: "path", width: 52 },
        { header: "Status", key: "statusCode", width: 10 },
        { header: "Fayllar", key: "files", width: 34 },
        { header: "IP", key: "ip", width: 18 },
        { header: "Vaqt (ms)", key: "responseTime", width: 12 },
      ];
      ws.getRow(1).font = { bold: true };

      rows.forEach((r) => {
        ws.addRow({
          date: r.createdAt ? new Date(r.createdAt).toLocaleString("uz-UZ") : "",
          userName: r.userName || fullName(r.user),
          module: r.module || "",
          method: r.method || "",
          path: r.path || "",
          statusCode: r.statusCode ?? "",
          files: (r.files || []).join(", "),
          ip: r.ip || "",
          responseTime: r.responseTime ?? "",
        });
      });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="audit-log.xlsx"',
      );
      await wb.xlsx.write(res);
      return res.end();
    } catch (err) {
      return next(
        new ErrorHandler(400, "Audit jurnalini eksport qilishda xatolik", err.message),
      );
    }
  },

  exportPdf: async (req, res, next) => {
    try {
      const rows = await Service.listForExport(req.query, 1000);

      const doc = pdf.createDoc();
      pdf.registerCyrillicFonts(doc);
      pdf.pipeToResponse(res, doc, "audit-jurnali");

      pdf.drawHeader(doc, "FARG'ONA JAMOAT SALOMATLIGI TIBBIYOT INSTITUTI");
      pdf.drawTitle(
        doc,
        "AUDIT JURNALI",
        `Jami ${rows.length} ta yozuv${rows.length === 1000 ? " (birinchi 1000 ta)" : ""}`,
      );

      pdf.drawTable(
        doc,
        [
          { header: "Sana", key: "date", width: 2.1 },
          { header: "Foydalanuvchi", key: "userName", width: 2.4 },
          { header: "Bo'lim", key: "module", width: 2 },
          { header: "Amal", key: "method", width: 1 },
          { header: "Natija", key: "statusCode", width: 1 },
          { header: "IP", key: "ip", width: 1.8 },
        ],
        rows.map((r) => ({
          date: r.createdAt ? new Date(r.createdAt).toLocaleString("uz-UZ") : "",
          userName: r.userName || fullName(r.user) || "—",
          module: r.module || "",
          method: r.method || "",
          statusCode: r.statusCode ?? "",
          ip: r.ip || "",
        })),
      );

      pdf.drawFooter(doc, "Audit jurnali", null);
      doc.end();
      return undefined;
    } catch (err) {
      return next(
        new ErrorHandler(400, "Audit jurnalini PDF qilishda xatolik", err.message),
      );
    }
  },

  findOne: async (req, res, next) => {
    try {
      const doc = await Service.findById(req.params.id);
      if (!doc) return next(new ErrorHandler(404, "Yozuv topilmadi"));
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Yozuvni o'qishda xatolik", err.message));
    }
  },
};
