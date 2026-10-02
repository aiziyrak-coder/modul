const { ErrorHandler } = require("#shared/error");
const ResidencySpecialty = require("./residencySpecialty.model");
const { searchOr } = require("../_services/searchTerm");

function buildFilter(query) {
  const { search, program, active } = query;
  const data = {};
  if (program) data.program = program;
  if (active !== undefined) data.active = active;
  const or = searchOr(search, ["title", "code"]);
  if (or) data.$or = or;
  return data;
}

module.exports = {
  buildFilter,
  addSpecialty: async (req, res, next) => {
    try {
      await new ResidencySpecialty(req.body).save();
      return res.status(201).json({ message: "successfully created" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to add specialty", err.message),
      );
    }
  },

  findAllSpecialties: async (req, res, next) => {
    try {
      const docs = await ResidencySpecialty.find(buildFilter(req.query)).sort({
        createdAt: -1,
      });
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find specialties", err.message),
      );
    }
  },

  paginateSpecialties: async (req, res, next) => {
    try {
      const { page, limit } = req.query;
      const doc = await ResidencySpecialty.paginate(buildFilter(req.query), {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 },
      });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to paginate specialties", err.message),
      );
    }
  },

  findOneSpecialty: async (req, res, next) => {
    try {
      const doc = await ResidencySpecialty.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find specialty", err.message),
      );
    }
  },

  updateSpecialty: async (req, res, next) => {
    try {
      const doc = await ResidencySpecialty.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true },
      );
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to update specialty", err.message),
      );
    }
  },

  deleteSpecialty: async (req, res, next) => {
    try {
      const doc = await ResidencySpecialty.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      await doc.softDelete(req.user?._id, req.body?.reason);
      return res.status(200).json({ message: "successfully deleted" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to delete specialty", err.message),
      );
    }
  },
};
