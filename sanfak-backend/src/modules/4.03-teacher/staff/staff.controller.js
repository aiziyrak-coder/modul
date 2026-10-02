"use strict";

const ExcelJS = require("exceljs");
const { ErrorHandler } = require("#shared/error");
const service = require("./staff.service");

const wrapErr = (err, message) =>
  err.statusCode ? err : new ErrorHandler(400, message, err.message);

module.exports = {
  addStaff: async (req, res, next) => {
    try {
      const doc = await service.create(req.body);
      return res
        .status(201)
        .json({ message: "Xodim yaratildi", _id: doc._id });
    } catch (err) {
      return next(wrapErr(err, "Xodim yaratishda xatolik"));
    }
  },

  findAllStaff: async (req, res, next) => {
    try {
      const docs = await service.findAll(req.query);
      return res.status(200).json(docs);
    } catch (err) {
      return next(wrapErr(err, "Xodimlarni olishda xatolik"));
    }
  },

  paginateStaff: async (req, res, next) => {
    try {
      const doc = await service.paginate(req.query);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Xodimlarni sahifalashda xatolik"));
    }
  },

  findOneStaff: async (req, res, next) => {
    try {
      const doc = await service.findOne(req.params.id);
      if (!doc) return res.status(404).json({ message: "Xodim topilmadi" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Xodimni olishda xatolik"));
    }
  },

  updateStaff: async (req, res, next) => {
    try {
      const doc = await service.update(req.params.id, req.body);
      if (!doc) return res.status(404).json({ message: "Xodim topilmadi" });
      return res.status(200).json({ message: "Xodim yangilandi" });
    } catch (err) {
      return next(wrapErr(err, "Xodimni yangilashda xatolik"));
    }
  },

  deleteStaff: async (req, res, next) => {
    try {
      const doc = await service.remove(req.params.id);
      if (!doc) return res.status(404).json({ message: "Xodim topilmadi" });
      return res.status(200).json({ message: "Xodim o'chirildi" });
    } catch (err) {
      return next(wrapErr(err, "Xodimni o'chirishda xatolik"));
    }
  },

  restoreStaff: async (req, res, next) => {
    try {
      const doc = await service.restore(req.params.id);
      if (!doc) return res.status(404).json({ message: "Xodim topilmadi" });
      return res.status(200).json({ message: "Xodim tiklandi" });
    } catch (err) {
      return next(wrapErr(err, "Xodimni tiklashda xatolik"));
    }
  },

  exportStaff: async (req, res, next) => {
    try {
      const rows = await service.exportRows(req.query);

      const wb = new ExcelJS.Workbook();
      wb.creator = "SANFAK AIS";
      const ws = wb.addWorksheet("Xodimlar", {
        views: [{ state: "frozen", ySplit: 1 }],
      });
      ws.columns = [
        { header: "F.I.SH", key: "fullName", width: 30 },
        { header: "Email", key: "email", width: 25 },
        { header: "Lavozim", key: "position", width: 20 },
        { header: "Kafedra", key: "department", width: 20 },
        { header: "Fakultet", key: "faculty", width: 20 },
        { header: "Telefon", key: "phone", width: 18 },
        { header: "Sana", key: "date", width: 15 },
      ];
      ws.getRow(1).font = { bold: true };
      ws.getRow(1).eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF12B76A" },
        };
      });
      rows.forEach((row) => ws.addRow(row));

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="staff.xlsx"',
      );
      await wb.xlsx.write(res);
      return res.end();
    } catch (err) {
      return next(wrapErr(err, "Xodimlarni eksport qilishda xatolik"));
    }
  },
};
