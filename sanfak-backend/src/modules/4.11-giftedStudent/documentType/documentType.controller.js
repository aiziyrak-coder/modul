const { ErrorHandler } = require("#shared/error");
const { searchRegex } = require("../_services/searchTerm");
const DocumentTypeModel = require("./documentType.model");

module.exports = {
  addDocumentType: async (req, res, next) => {
    try {
      const doc = await new DocumentTypeModel(req.body).save();
      return res.status(201).json({ message: "successfully created", id: doc._id });
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to add document type", err.message));
    }
  },

  findAllDocumentTypes: async (req, res, next) => {
    try {
      const { search, active } = req.query;
      const filter = {};
      const rx = searchRegex(search);
      if (rx) filter.title = rx;
      if (active !== undefined) filter.active = active;
      const docs = await DocumentTypeModel.find(filter, { createdAt: 0, updatedAt: 0 }).exec();
      return res.status(200).json(docs);
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to find document types", err.message));
    }
  },

  updateDocumentType: async (req, res, next) => {
    try {
      const doc = await DocumentTypeModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to update document type", err.message));
    }
  },

  deleteDocumentType: async (req, res, next) => {
    try {
      const doc = await DocumentTypeModel.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      await doc.softDelete(req.user?._id, req.body?.reason);
      return res.status(200).json({ message: `successfully deleted ${doc?._id}` });
    } catch (err) {
      return next(new ErrorHandler(400, "Failed to delete document type", err.message));
    }
  },
};
