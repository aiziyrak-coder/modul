const Service = require("./publicMethodical.service");

module.exports = {
  getSpecialties: async (req, res, next) => {
    try {
      return res.status(200).json({ success: true, data: await Service.specialties() });
    } catch (err) {
      return next(err);
    }
  },

  getAcademicYears: async (req, res, next) => {
    try {
      return res.status(200).json({ success: true, data: await Service.academicYears() });
    } catch (err) {
      return next(err);
    }
  },

  getTemplates: async (req, res, next) => {
    try {
      return res.status(200).json({ success: true, data: await Service.templates() });
    } catch (err) {
      return next(err);
    }
  },

  ensureRefsValid: async (req, res, next) => {
    try {
      await Service.assertSpecialty(req.body.specialty);
      await Service.assertAcademicYear(req.body.academicYear);
      return next();
    } catch (err) {
      return next(err);
    }
  },

  submit: async (req, res, next) => {
    try {
      const data = await Service.submit(req.body);
      return res.status(201).json({
        success: true,
        message: "Uslubiy tavsiyanoma qabul qilindi. Ilmiy bo'lim ko'rib chiqadi.",
        data,
      });
    } catch (err) {
      return next(err);
    }
  },
};
