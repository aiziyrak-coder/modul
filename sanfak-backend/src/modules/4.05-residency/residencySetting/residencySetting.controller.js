"use strict";

const { ErrorHandler } = require("#shared/error");
const service = require("./residencySetting.service");
const { workDayOrderError, absenceFitError } = require("./residencySetting.model");

module.exports = {
  getSettings: async (req, res, next) => {
    try {
      return res.status(200).json(await service.getOrCreate());
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to get residency settings", err.message),
      );
    }
  },

  updateSettings: async (req, res, next) => {
    try {
      const current = await service.getOrCreate();
      const invalid =
        workDayOrderError(req.body, current) || absenceFitError(req.body, current);
      if (invalid) return res.status(400).json({ message: invalid });

      const doc = await service.update(req.body, req.user?._id);
      return res.status(200).json({ message: "successfully updated", data: doc });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to update residency settings", err.message),
      );
    }
  },
};
