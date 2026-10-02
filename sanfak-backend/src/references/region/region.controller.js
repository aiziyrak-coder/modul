const { ErrorHandler } = require("#shared/error");
const Region = require("./region.model");

const buildFilter = (q) => {
  const f = {};
  if (q.active !== undefined) f.active = q.active;
  if (q.province) f.province = q.province;
  if (q.search) f.title = { $regex: String(q.search).trim(), $options: "i" };
  return f;
};

module.exports = {
  create: async (req, res, next) => {
    try {
      const doc = await new Region(req.body).save();
      return res
        .status(201)
        .json({ message: "successfully created", _id: doc._id });
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to add region", err.message));
    }
  },

  findAll: async (req, res, next) => {
    try {
      const docs = await Region.find(buildFilter(req.query))
        .populate({ path: "province", select: "title" })
        .sort({ title: 1 })
        .lean();
      return res.status(200).json(docs || []);
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to find regions", err.message));
    }
  },

  paginate: async (req, res, next) => {
    try {
      const { page, limit } = req.query;
      const doc = await Region.paginate(buildFilter(req.query), {
        page: Number(page),
        limit: Number(limit),
        sort: { title: 1 },
        populate: { path: "province", select: "title" },
        lean: true,
      });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to paginate regions", err.message),
      );
    }
  },

  findOne: async (req, res, next) => {
    try {
      const doc = await Region.findById(req.params.id).lean();
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to find region", err.message));
    }
  },

  update: async (req, res, next) => {
    try {
      const doc = await Region.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
      });
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to update region", err.message));
    }
  },

  delete: async (req, res, next) => {
    try {
      const doc = await Region.findByIdAndDelete(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res
        .status(200)
        .json({ message: `successfully deleted ${doc._id}` });
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to delete region", err.message));
    }
  },
};
