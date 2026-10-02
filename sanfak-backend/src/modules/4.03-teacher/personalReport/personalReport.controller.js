const ExcelJS = require("exceljs");
const { ErrorHandler } = require("#shared/error");
const service = require("./personalReport.service");

const wrapErr = (err, message) =>
  err.statusCode ? err : new ErrorHandler(400, message, err.message);

const buildExcel = (title, rows) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SANFAK AIS";
  const ws = wb.addWorksheet(title, { views: [{ state: "frozen", ySplit: 2 }] });

  if (!rows.length) {
    ws.addRow([title]);
    ws.addRow(["Ma'lumot topilmadi"]);
    return wb;
  }

  const keys = Object.keys(rows[0]);
  ws.mergeCells(1, 1, 1, keys.length);
  ws.getRow(1).getCell(1).value = title;
  ws.getRow(1).getCell(1).font = { bold: true, size: 13 };
  ws.getRow(1).getCell(1).alignment = { horizontal: "center" };

  const header = ws.addRow(keys);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF12B76A" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  ws.columns = keys.map((k) => ({ key: k, width: Math.max(k.length + 4, 12) }));
  rows.forEach((row) => ws.addRow(Object.values(row)));
  return wb;
};

const STATUS_LABELS = {
  draft: "Yangi",
  submitted: "Yuborilgan",
  approved: "Tasdiqlangan",
  rejected: "Rad etilgan",
};

const reportRow = (r, i) => ({
  "№": i + 1,
  "F.I.SH": `${r.teacher?.lastName || ""} ${r.teacher?.firstName || ""} ${r.teacher?.middleName || ""}`.trim() || "—",
  Semestr: r.semester,
  "O'quv yili": r.academicYear?.title || "—",
  "Yaratilgan sana": r.createdAt ? new Date(r.createdAt).toLocaleDateString("uz-UZ") : "—",
  Status: STATUS_LABELS[r.status] || r.status || "—",
});

module.exports = {
  addReport: async (req, res, next) => {
    try {
      const doc = await service.create(req.body, req.user);
      return res.status(201).json({ message: "Hisobot yaratildi", data: doc });
    } catch (err) {
      return next(wrapErr(err, "Hisobot yaratishda xatolik"));
    }
  },

  findAllReports: async (req, res, next) => {
    try {
      const docs = await service.findAll(req.scope, req.query, req.user);
      return res.status(200).json(docs);
    } catch (err) {
      return next(wrapErr(err, "Hisobotlarni olishda xatolik"));
    }
  },

  paginateReports: async (req, res, next) => {
    try {
      const doc = await service.paginate(req.scope, req.query, req.user);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Sahifalashda xatolik"));
    }
  },

  exportReports: async (req, res, next) => {
    try {
      const rows = await service.exportRows(req.scope, req.query, req.user);
      const wb = buildExcel("Hisobotlar", rows.map(reportRow));
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="personal-reports.xlsx"',
      );
      await wb.xlsx.write(res);
      return res.end();
    } catch (err) {
      return next(wrapErr(err, "Eksport qilishda xatolik"));
    }
  },

  findOneReport: async (req, res, next) => {
    try {
      const doc = await service.findOne(req.params.id, req.scope, req.user);
      if (!doc) return res.status(404).json({ message: "Topilmadi" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Hisobotni olishda xatolik"));
    }
  },

  updateReport: async (req, res, next) => {
    try {
      const doc = await service.update(req.params.id, req.user, req.scope, req.body);
      return res.status(200).json({ message: "Hisobot yangilandi", data: doc });
    } catch (err) {
      return next(wrapErr(err, "Yangilashda xatolik"));
    }
  },

  deleteReport: async (req, res, next) => {
    try {
      await service.remove(req.params.id, req.scope, req.user);
      return res.status(200).json({ message: "Hisobot o'chirildi" });
    } catch (err) {
      return next(wrapErr(err, "O'chirishda xatolik"));
    }
  },

  submitReport: async (req, res, next) => {
    try {
      const doc = await service.submit(req.params.id, req.user, req.scope);
      return res.status(200).json({
        message: "Hisobot ko'rib chiqish uchun yuborildi",
        status: doc.status,
      });
    } catch (err) {
      return next(wrapErr(err, "Yuborishda xatolik"));
    }
  },

  approveReport: async (req, res, next) => {
    try {
      const { report, entry } = await service.approve(
        req.params.id,
        req.user,
        req.scope,
        req.body,
      );
      return res.status(200).json({
        message: `"${entry.label || entry.step}" bosqichi tasdiqlandi`,
        approvedStep: entry.step,
        status: report.status,
        approvals: report.approvals,
      });
    } catch (err) {
      return next(wrapErr(err, "Tasdiqlashda xatolik"));
    }
  },

  rejectReport: async (req, res, next) => {
    try {
      const { report, entry } = await service.reject(
        req.params.id,
        req.user,
        req.scope,
        req.body,
      );
      return res.status(200).json({
        message: `"${entry.label || entry.step}" bosqichi rad etildi`,
        rejectedStep: entry.step,
        status: report.status,
        approvals: report.approvals,
      });
    } catch (err) {
      return next(wrapErr(err, "Rad etishda xatolik"));
    }
  },
};
