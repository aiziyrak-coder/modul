const { ErrorHandler } = require("#shared/error");
const EvaluationCriteriaModel = require("./evaluationCriteria.model");
const {
  mergeCategories,
} = require("#modules/4.11-giftedStudent/_services/mergeCategories");
const {
  searchRegex,
} = require("#modules/4.11-giftedStudent/_services/searchTerm");

module.exports = {
  addCriteria: async (req, res, next) => {
    try {
      const doc = await new EvaluationCriteriaModel(req.body).save();
      return res
        .status(201)
        .json({ message: "successfully created", id: doc._id });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to add evaluation criteria", err.message),
      );
    }
  },

  findAllCriteria: async (req, res, next) => {
    try {
      const { search, active } = req.query;
      const data = {};
      const rx = searchRegex(search);
      if (rx) data.name = rx;
      if (active !== undefined) data.active = active;

      const docs = await EvaluationCriteriaModel.find(data, {
        createdAt: 0,
        updatedAt: 0,
      }).exec();
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find evaluation criteria", err.message),
      );
    }
  },

  updateCriteria: async (req, res, next) => {
    try {
      const current = await EvaluationCriteriaModel.findById(req.params.id);
      if (!current) return res.status(404).json({ message: "not found" });

      const payload = { ...req.body };
      if (Array.isArray(payload.categories)) {
        payload.categories = mergeCategories(
          payload.categories,
          current.categories,
        );
      }

      const doc = await EvaluationCriteriaModel.findByIdAndUpdate(
        req.params.id,
        payload,
        { new: true },
      );
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Failed to update evaluation criteria",
          err.message,
        ),
      );
    }
  },

  deleteCriteria: async (req, res, next) => {
    try {
      const doc = await EvaluationCriteriaModel.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      await doc.softDelete(req.user?._id, req.body?.reason);
      return res
        .status(200)
        .json({ message: `successfully deleted ${doc?._id}` });
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Failed to delete evaluation criteria",
          err.message,
        ),
      );
    }
  },
};
