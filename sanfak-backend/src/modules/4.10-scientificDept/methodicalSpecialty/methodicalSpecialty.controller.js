const Service = require("./methodicalSpecialty.service");

module.exports = {
  addSpecialty: async (req, res, next) => {
    try {
      return res.status(201).json(await Service.create(req.body));
    } catch (err) {
      return next(err);
    }
  },

  findAllSpecialties: async (req, res, next) => {
    try {
      return res.status(200).json(await Service.list(req.query));
    } catch (err) {
      return next(err);
    }
  },

  paginateSpecialties: async (req, res, next) => {
    try {
      return res.status(200).json(await Service.paginate(req.query));
    } catch (err) {
      return next(err);
    }
  },

  findOneSpecialty: async (req, res, next) => {
    try {
      return res.status(200).json(await Service.findById(req.params.id));
    } catch (err) {
      return next(err);
    }
  },

  updateSpecialty: async (req, res, next) => {
    try {
      return res.status(200).json(await Service.update(req.params.id, req.body));
    } catch (err) {
      return next(err);
    }
  },

  deleteSpecialty: async (req, res, next) => {
    try {
      return res.status(200).json(await Service.remove(req.params.id));
    } catch (err) {
      return next(err);
    }
  },
};
