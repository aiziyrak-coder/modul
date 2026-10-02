const Service = require("./publicExam.service");

module.exports = {
  getSpecialties: async (req, res, next) => {
    try {
      return res.status(200).json(await Service.openSpecialties());
    } catch (err) {
      return next(err);
    }
  },

  getCourses: async (req, res, next) => {
    try {
      return res.status(200).json(await Service.courses());
    } catch (err) {
      return next(err);
    }
  },

  ensureSpecialtyOpen: async (req, res, next) => {
    try {
      await Service.assertSpecialtyOpen(req.body.specialization);
      return next();
    } catch (err) {
      return next(err);
    }
  },

  submitApplication: async (req, res, next) => {
    try {
      const data = await Service.submit(req.body);
      return res.status(201).json({
        success: true,
        message: "Arizangiz qabul qilindi. Ilmiy bo'lim ko'rib chiqadi.",
        data,
      });
    } catch (err) {
      return next(err);
    }
  },
};
