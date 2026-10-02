const { ErrorHandler } = require("#shared/error");
const Indicator = require("./indicator.model");
const IndicatorSubmission = require("#modules/4.12-qualityAssurance/indicatorSubmission/indicatorSubmission.model");

module.exports = {
  addIndicator: async (req, res, next) => {
    try {
      const doc = await new Indicator(req.body).save();
      if (!doc) return res.status(404).json({ message: "Failed to save" });
      return res.status(201).json({ message: "successfully created" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to add indicator", err.message),
      );
    }
  },

  findAllIndicators: async (req, res, next) => {
    try {
      const { search, active } = req.query;
      let data = {};
      if (search) data.title = { $regex: new RegExp(search, "i") };
      if (typeof active === "boolean") data["active"] = active;

      const docs = await Indicator.find(data, {
        createdAt: 0,
        updatedAt: 0,
      })
        .sort({ order: 1 })

        .exec();
      if (!docs) return res.status(404).json({ message: "not found" });
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find indicators", err.message),
      );
    }
  },

  paginateIndicators: async (req, res, next) => {
    try {
      const { search, active, page, limit } = req.query;
      let data = {};
      if (search) data.title = { $regex: new RegExp(search, "i") };
      if (typeof active === "boolean") data["active"] = active;

      const options = {
        limit: parseInt(limit),
        page: parseInt(page),
        select: ["-createdAt", "-updatedAt"],
      };
      const doc = await Indicator.paginate(data, options);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to paginate indicators", err.message),
      );
    }
  },

  findOneIndicator: async (req, res, next) => {
    try {
      let doc = await Indicator.findById(req.params.id, {
        createdAt: 0,
        updatedAt: 0,
      })

        .exec();
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find indicator", err.message),
      );
    }
  },

  updateIndicator: async (req, res, next) => {
    try {
      const doc = await Indicator.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      });
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to update indicator", err.message),
      );
    }
  },

  deleteIndicator: async (req, res, next) => {
    try {
      const used = await IndicatorSubmission.countDocuments({
        indicator: req.params.id,
      });
      if (used > 0) {
        return next(
          new ErrorHandler(
            409,
            "Indikatorga bog'langan ma'lumotlar bor — o'chirib bo'lmaydi",
            `Yuborilgan ma'lumotlar soni: ${used}`,
            { reason: "has_submissions", submissionCount: used },
          ),
        );
      }

      const doc = await Indicator.findByIdAndDelete(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res
        .status(200)
        .json({ message: `successfully deleted ${doc?._id}` });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to delete indicator", err.message),
      );
    }
  },
};
