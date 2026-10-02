const { createCrudController, wrapErr } = require("../lib/crudController");
const service = require("./admissionSeason.service");

const base = createCrudController(service, "Qabul mavsumi");

module.exports = {
  ...base,

  closeSeason: async (req, res, next) => {
    try {
      await service.close(req.user, req.params.id);
      return res.status(200).json({ message: "Qabul mavsumi yopildi" });
    } catch (err) {
      return next(wrapErr(err, "Qabul mavsumi yopilmadi"));
    }
  },

  academicYears: async (req, res, next) => {
    try {
      const docs = await service.distinctAcademicYears();
      return res.status(200).json(docs);
    } catch (err) {
      return next(wrapErr(err, "O'quv yillari olinmadi"));
    }
  },

  findOpen: async (req, res, next) => {
    try {
      const doc = await service.findOpenSeason();
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Ochiq qabul mavsumi olinmadi"));
    }
  },
};
