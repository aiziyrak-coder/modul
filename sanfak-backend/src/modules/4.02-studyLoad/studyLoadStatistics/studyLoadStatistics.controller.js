"use strict";
const winston = require("#shared/winston.logger");
const { ErrorHandler } = require("#shared/error");
const service = require("./studyLoadStatistics.service");

const wrapErr = (err, message) => {
  if (err.statusCode) return err;
  winston.error(`[studyLoadStatistics] ${message}: ${err.message}`);
  return new ErrorHandler(500, message);
};

module.exports = {
  overview: async (req, res, next) => {
    try {
      const data = await service.overview();
      return res.status(200).json(data);
    } catch (error) {
      winston.error(error.message);
      return next(error);
    }
  },

  oubOverview: async (req, res, next) => {
    try {
      const data = await service.oubOverview(req.scope, req.query, req.user?.role?.scopeLevel);
      return res.status(200).json(data);
    } catch (error) {
      return next(wrapErr(error, "Statistikani olishda xatolik"));
    }
  },

  oubFaculties: async (req, res, next) => {
    try {
      const data = await service.oubFaculties(req.scope, req.query, req.user?.role?.scopeLevel);
      return res.status(200).json(data);
    } catch (error) {
      return next(wrapErr(error, "Fakultet kesimidagi statistikani olishda xatolik"));
    }
  },

  oubTeachers: async (req, res, next) => {
    try {
      const data = await service.oubTeachers(req.scope, req.query, req.user?.role?.scopeLevel);
      return res.status(200).json(data);
    } catch (error) {
      return next(wrapErr(error, "O'qituvchilar statistikasini olishda xatolik"));
    }
  },
};
