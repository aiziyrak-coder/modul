const { ErrorHandler } = require("#shared/error");
const service = require("./public.service");

const wrapErr = (err, message) =>
  err.statusCode ? err : new ErrorHandler(400, message, err.message);

const readHandler = (fn, errMessage) => async (req, res, next) => {
  try {
    return res.status(200).json(await fn(req.query.language));
  } catch (err) {
    return next(wrapErr(err, errMessage));
  }
};

const readByDirection = (fn, errMessage) => async (req, res, next) => {
  try {
    return res.status(200).json(await fn(req.query.language, req.query.direction));
  } catch (err) {
    return next(wrapErr(err, errMessage));
  }
};

module.exports = {
  getDirections: readHandler(service.directions, "Yo'nalishlar olinmadi"),
  getEducationForms: readByDirection(service.educationForms, "Ta'lim shakllari olinmadi"),
  getEducationLanguages: readByDirection(service.educationLanguages, "Ta'lim tillari olinmadi"),
  getCountries: readHandler(service.countries, "Davlatlar olinmadi"),
  getOffer: readHandler(service.offer, "Ommaviy oferta olinmadi"),
  getOpenSeason: readHandler(service.openSeason, "Qabul mavsumi olinmadi"),

  submitApplication: async (req, res, next) => {
    try {
      const doc = await service.submitApplication(req.body);
      return res.status(201).json({
        message: "Arizangiz qabul qilindi",
        ...doc,
      });
    } catch (err) {
      return next(wrapErr(err, "Ariza yuborilmadi"));
    }
  },

  getApplicationStatus: async (req, res, next) => {
    try {
      const doc = await service.applicationStatus(req.params.applicationNumber);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Ariza holati olinmadi"));
    }
  },

  lookupApplicationStatus: async (req, res, next) => {
    try {
      const doc = await service.lookupStatus(req.body);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Ariza holati olinmadi"));
    }
  },
};
