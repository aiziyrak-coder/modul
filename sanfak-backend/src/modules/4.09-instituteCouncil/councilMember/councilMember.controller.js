const { ErrorHandler } = require("#shared/error");
const service = require("./councilMember.service");

module.exports = {
  addMember: async (req, res, next) => {
    try {
      const doc = await service.create(req.body);
      if (!doc) return res.status(404).json({ message: "Failed to save" });
      return res
        .status(201)
        .json({ message: "successfully created", _id: doc._id });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to add council member", err.message),
      );
    }
  },

  findAllMembers: async (req, res, next) => {
    try {
      const filter = await service.buildFilter(req.query);
      const docs = await service.findAll(filter);
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find council members", err.message),
      );
    }
  },

  paginateMembers: async (req, res, next) => {
    try {
      const filter = await service.buildFilter(req.query);
      const doc = await service.paginate(filter, req.query);
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to paginate council members", err.message),
      );
    }
  },

  findOneMember: async (req, res, next) => {
    try {
      const doc = await service.findOne(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find council member", err.message),
      );
    }
  },

  updateMember: async (req, res, next) => {
    try {
      const doc = await service.update(req.params.id, req.body);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to update council member", err.message),
      );
    }
  },

  deleteMember: async (req, res, next) => {
    try {
      const doc = await service.remove(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res
        .status(200)
        .json({ message: `successfully deleted ${doc?._id}` });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to delete council member", err.message),
      );
    }
  },

  userOptions: async (req, res, next) => {
    try {
      const docs = await service.userOptions(req.query.department);
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to list user options", err.message),
      );
    }
  },

  toggleVote: async (req, res, next) => {
    try {
      const doc = await service.toggleVote(req.params.id, req.body.canVote);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to toggle vote", err.message),
      );
    }
  },
};
