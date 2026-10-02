const { ErrorHandler } = require("#shared/error");
const PermissionModel = require("./permission.model");

module.exports = {
  addPermission: async (req, res, next) => {
    try {
      const doc = new PermissionModel(req.body);
      await doc.save();

      return res.status(201).json({ message: "successfully created" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to add new permission", err.message),
      );
    }
  },

  findAllPermissions: async (req, res, next) => {
    try {
      const { search, active, group } = req.query;
      let data = {};

      if (search) data[`section`] = { $regex: new RegExp(search, "i") };
      if (typeof active === "boolean") data["active"] = active;
      if (group) data["groups"] = group;

      const docs = await PermissionModel.find(data, {
        createdAt: 0,
        updatedAt: 0,
      })
        .populate("groups", "code title")
        .exec();

      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find permissions", err.message),
      );
    }
  },

  paginatePermissions: async (req, res, next) => {
    try {
      const { search, active, group, page, limit } = req.query;
      let data = {};

      if (search) data[`section`] = { $regex: new RegExp(search, "i") };
      if (typeof active === "boolean") data["active"] = active;
      if (group) data["groups"] = group;

      const options = {
        limit: parseInt(limit),
        page: parseInt(page),
        select: ["-createdAt", "-updatedAt"],
        populate: { path: "groups", select: "code title" },
      };

      const doc = await PermissionModel.paginate(data, options);
      if (!doc) return res.status(404).json({ message: "not found" });

      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to paginate permissions", err.message),
      );
    }
  },

  findOnePermission: async (req, res, next) => {
    try {
      const doc = await PermissionModel.findById(req.params.id, {
        createdAt: 0,
        updatedAt: 0,
      })
        .populate("groups", "code title")
        .exec();

      if (!doc) {
        return next(new ErrorHandler(404, "Permission not found"));
      }

      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find permission", err.message),
      );
    }
  },

  updatePermission: async (req, res, next) => {
    try {
      const doc = await PermissionModel.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          new: true,
        },
      );

      if (!doc) {
        return next(new ErrorHandler(404, "Permission not found"));
      }

      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to update permission", err.message),
      );
    }
  },

  deletePermission: async (req, res, next) => {
    try {
      const doc = await PermissionModel.findByIdAndDelete(req.params.id);

      if (!doc) {
        return next(new ErrorHandler(404, "Permission not found"));
      }

      return res
        .status(200)
        .json({ message: `successfully deleted ${doc._id}` });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to delete permission", err.message),
      );
    }
  },
};
