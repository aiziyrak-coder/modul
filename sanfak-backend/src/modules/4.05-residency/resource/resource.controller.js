const { ErrorHandler } = require("#shared/error");
const Resource = require("./resource.model");
const { searchOr } = require("../_services/searchTerm");

const POP = [
  { path: "department", select: "title" },
  { path: "uploadedBy", select: "firstName lastName middleName" },
  { path: "specialty", select: "title code" },
];

function buildFilter(query) {
  const { search, resourceType, specialty, department, active } = query;
  const data = {};
  if (resourceType) data.resourceType = resourceType;
  if (specialty) data.specialty = specialty;
  if (department) data.department = department;
  if (active !== undefined) data.active = active;
  const or = searchOr(search, ["title", "author"]);
  if (or) data.$or = or;
  return data;
}

module.exports = {
  addResource: async (req, res, next) => {
    try {
      await new Resource({ ...req.body, uploadedBy: req.user?._id }).save();
      return res.status(201).json({ message: "successfully created" });
    } catch (err) {
      return next(new ErrorHandler(400, "Manba qo'shishda xato", err.message));
    }
  },

  findAllResources: async (req, res, next) => {
    try {
      const docs = await Resource.find(buildFilter(req.query))
        .populate(POP)
        .sort({ createdAt: -1 });
      return res.status(200).json(docs);
    } catch (err) {
      return next(new ErrorHandler(400, "Manbalar ro'yxati xatosi", err.message));
    }
  },

  paginateResources: async (req, res, next) => {
    try {
      const { page, limit } = req.query;
      const doc = await Resource.paginate(buildFilter(req.query), {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 },
        populate: POP,
      });
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Manba sahifalash xatosi", err.message));
    }
  },

  statsResources: async (req, res, next) => {
    try {
      const match = Resource.find(buildFilter(req.query)).cast(Resource);
      const [row] = await Resource.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            pdf: { $sum: { $cond: [{ $eq: ["$format", "PDF"] }, 1, 0] } },
            video: { $sum: { $cond: [{ $eq: ["$resourceType", "video"] }, 1, 0] } },
            downloads: { $sum: { $ifNull: ["$downloadCount", 0] } },
          },
        },
      ]);
      return res
        .status(200)
        .json(row ? { ...row, _id: undefined } : { total: 0, pdf: 0, video: 0, downloads: 0 });
    } catch (err) {
      return next(new ErrorHandler(400, "Manba statistikasi xatosi", err.message));
    }
  },

  findOneResource: async (req, res, next) => {
    try {
      const doc = await Resource.findById(req.params.id).populate(POP);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Manbani olishda xato", err.message));
    }
  },

  downloadResource: async (req, res, next) => {
    try {
      const doc = await Resource.findByIdAndUpdate(
        req.params.id,
        { $inc: { downloadCount: 1 } },
        { new: true },
      );
      if (!doc) return res.status(404).json({ message: "not found" });
      return res
        .status(200)
        .json({ fileUrl: doc.fileUrl, downloadCount: doc.downloadCount });
    } catch (err) {
      return next(new ErrorHandler(400, "Yuklab olishda xato", err.message));
    }
  },

  updateResource: async (req, res, next) => {
    try {
      const doc = await Resource.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      });
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(new ErrorHandler(400, "Manbani yangilashda xato", err.message));
    }
  },

  deleteResource: async (req, res, next) => {
    try {
      const doc = await Resource.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      await doc.softDelete(req.user?._id, req.body?.reason);
      return res.status(200).json({ message: "successfully deleted" });
    } catch (err) {
      return next(new ErrorHandler(400, "Manbani o'chirishda xato", err.message));
    }
  },
};
