const { ErrorHandler } = require("#shared/error");
const Province = require("./province.model");

const buildFilter = (q) => {
  const f = {};
  if (q.active !== undefined) f.active = q.active;
  if (q.search) f.title = { $regex: String(q.search).trim(), $options: "i" };
  return f;
};

module.exports = {
  create: async (req, res, next) => {
    try {
      const doc = await new Province(req.body).save();
      return res
        .status(201)
        .json({ message: "successfully created", _id: doc._id });
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to add province", err.message));
    }
  },

  findAll: async (req, res, next) => {
    try {
      const docs = await Province.find(buildFilter(req.query))
        .sort({ title: 1 })
        .lean();
      return res.status(200).json(docs || []);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find provinces", err.message),
      );
    }
  },

  paginate: async (req, res, next) => {
    try {
      const { page, limit } = req.query;
      const doc = await Province.paginate(buildFilter(req.query), {
        page: Number(page),
        limit: Number(limit),
        sort: { title: 1 },
        lean: true,
      });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to paginate provinces", err.message),
      );
    }
  },

  findOne: async (req, res, next) => {
    try {
      const doc = await Province.findById(req.params.id).lean();
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to find province", err.message));
    }
  },

  update: async (req, res, next) => {
    try {
      const doc = await Province.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
      });
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to update province", err.message),
      );
    }
  },

  delete: async (req, res, next) => {
    try {
      const doc = await Province.findByIdAndDelete(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res
        .status(200)
        .json({ message: `successfully deleted ${doc._id}` });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to delete province", err.message),
      );
    }
  },
};
