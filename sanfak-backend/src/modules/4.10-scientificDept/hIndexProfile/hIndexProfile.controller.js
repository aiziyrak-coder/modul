const ExcelJS = require("exceljs");
const { ErrorHandler } = require("#shared/error");
const service = require("./hIndexProfile.service");

const wrapErr = (err, message) =>
  err.statusCode ? err : new ErrorHandler(400, message, err.message);

module.exports = {
  upsertMine: async (req, res, next) => {
    try {
      const doc = await service.upsertMine(req.user, req.body);
      return res.status(200).json(doc);
    } catch (err) {
      if (err && err.code === 11000) {
        return next(new ErrorHandler(409, "Profil allaqachon mavjud", err.message));
      }
      return next(wrapErr(err, "Profil saqlanmadi"));
    }
  },

  refreshMine: async (req, res, next) => {
    try {
      const doc = await service.refreshMine(req.user);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Scopus'dan yangilanmadi"));
    }
  },

  refreshProfile: async (req, res, next) => {
    try {
      const doc = await service.refreshById(req.params.id, req.scope);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Scopus'dan yangilanmadi"));
    }
  },

  exportProfiles: async (req, res, next) => {
    try {
      const rows = await service.exportRows(req.query, req.scope);

      const wb = new ExcelJS.Workbook();
      wb.creator = "SANFAK AIS";
      const ws = wb.addWorksheet("H-indeks", {
        views: [{ state: "frozen", ySplit: 1 }],
      });
      ws.columns = [
        { header: "№", key: "no", width: 6 },
        { header: "O'qituvchi", key: "teacher", width: 30 },
        { header: "Fakultet", key: "faculty", width: 24 },
        { header: "Kafedra", key: "department", width: 24 },
        { header: "Scopus havolasi", key: "scopusUrl", width: 42 },
        { header: "Scopus h-index", key: "scopusHIndex", width: 15 },
        { header: "Scopus iqtiboslar", key: "scopusCitations", width: 17 },
        { header: "Scopus hujjatlar", key: "scopusDocuments", width: 16 },
        { header: "Scholar havolasi", key: "scholarUrl", width: 42 },
        { header: "Scholar h-index", key: "scholarHIndex", width: 15 },
        { header: "Scholar iqtiboslar", key: "scholarCitations", width: 17 },
        { header: "Scholar i10-index", key: "scholarI10Index", width: 17 },
        { header: "Oxirgi yangilanish", key: "syncedAt", width: 18 },
      ];
      ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
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
      res.setHeader("Content-Disposition", 'attachment; filename="h-index.xlsx"');
      await wb.xlsx.write(res);
      return res.end();
    } catch (err) {
      if (res.headersSent) return undefined;
      return next(wrapErr(err, "H-indeks eksport qilinmadi"));
    }
  },

  findMine: async (req, res, next) => {
    try {
      const doc = await service.getMine(req.user);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Profil olinmadi"));
    }
  },

  findAllProfiles: async (req, res, next) => {
    try {
      const docs = await service.list(req.query, req.scope);
      return res.status(200).json(docs);
    } catch (err) {
      return next(wrapErr(err, "Profillar ro'yxati olinmadi"));
    }
  },

  paginateProfiles: async (req, res, next) => {
    try {
      const doc = await service.paginate(req.query, req.scope);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Profillar sahifasi olinmadi"));
    }
  },

  findOneProfile: async (req, res, next) => {
    try {
      const doc = await service.findById(req.params.id, req.scope);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Profil topilmadi"));
    }
  },
};
