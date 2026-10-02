const { ErrorHandler } = require("#shared/error");
const TheoryTopic = require("./residencyTheoryTopic.model");
const { searchRegex } = require("../_services/searchTerm");

function buildFilter(query) {
  const { search, active } = query;
  const data = {};
  if (active !== undefined) data.active = active;
  const rx = searchRegex(search);
  if (rx) data.title = rx;
  return data;
}

module.exports = {
  addTopic: async (req, res, next) => {
    try {
      await new TheoryTopic(req.body).save();
      return res.status(201).json({ message: "successfully created" });
    } catch (err) {
      return next(new ErrorHandler(400, "Nazariy bilim qo'shishda xato", err.message));
    }
  },

  findAllTopics: async (req, res, next) => {
    try {
      const docs = await TheoryTopic.find(buildFilter(req.query)).sort({ title: 1 });
      return res.status(200).json(docs);
    } catch (err) {
      return next(new ErrorHandler(400, "Nazariy bilim ro'yxati xatosi", err.message));
    }
  },

  paginateTopics: async (req, res, next) => {
    try {
      const { page, limit } = req.query;
      const doc = await TheoryTopic.paginate(buildFilter(req.query), {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { title: 1 },
      });
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Nazariy bilim sahifalash xatosi", err.message));
    }
  },

  updateTopic: async (req, res, next) => {
    try {
      const doc = await TheoryTopic.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      });
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(new ErrorHandler(400, "Nazariy bilimni yangilashda xato", err.message));
    }
  },

  deleteTopic: async (req, res, next) => {
    try {
      const doc = await TheoryTopic.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      await doc.softDelete(req.user?._id, req.body?.reason);
      return res.status(200).json({ message: "successfully deleted" });
    } catch (err) {
      return next(new ErrorHandler(400, "Nazariy bilimni o'chirishda xato", err.message));
    }
  },
};
