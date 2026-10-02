const mongoose = require("mongoose");

function softDeletePlugin(schema, options = {}) {
  const opts = {
    indexDeleted: true,
    ...options,
  };

  schema.add({
    deletedAt: {
      type: Date,
      default: null,
      index: opts.indexDeleted,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },
    deletionReason: { type: String, default: null },

    archivedAt: {
      type: Date,
      default: null,
      index: opts.indexDeleted,
    },
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },
    archiveReason: { type: String, default: null },
  });

  const findHooks = ["find", "findOne", "findOneAndUpdate", "count", "countDocuments", "estimatedDocumentCount"];
  for (const hook of findHooks) {
    schema.pre(hook, function (next) {
      const includeDeleted =
        this.getOptions?.()?.includeDeleted ||
        this.getQuery?.()?.includeDeleted;

      if (!includeDeleted) {
        const q = this.getQuery();
        if (q.deletedAt === undefined) {
          this.where({ deletedAt: null });
        }
      } else {
        const q = this.getQuery();
        if (q.includeDeleted !== undefined) {
          delete q.includeDeleted;
        }
      }
      next();
    });
  }

  schema.pre("aggregate", function (next) {
    const opts = this.options || {};
    if (!opts.includeDeleted) {
      this.pipeline().unshift({ $match: { deletedAt: null } });
    }
    next();
  });

  schema.methods.softDelete = function (userId, reason) {
    this.deletedAt = new Date();
    this.deletedBy = userId || null;
    this.deletionReason = reason || null;
    return this.save();
  };

  schema.methods.restore = function () {
    this.deletedAt = null;
    this.deletedBy = null;
    this.deletionReason = null;
    return this.save();
  };

  schema.methods.archive = function (userId, reason) {
    this.archivedAt = new Date();
    this.archivedBy = userId || null;
    this.archiveReason = reason || null;
    return this.save();
  };

  schema.methods.unarchive = function () {
    this.archivedAt = null;
    this.archivedBy = null;
    this.archiveReason = null;
    return this.save();
  };

  schema.statics.findDeleted = function (filter = {}) {
    return this.find(
      { ...filter, deletedAt: { $ne: null } },
      null,
      { includeDeleted: true },
    );
  };

  schema.statics.findArchived = function (filter = {}) {
    return this.find({ ...filter, archivedAt: { $ne: null } });
  };

  schema.statics.findWithDeleted = function (filter = {}) {
    return this.find(filter, null, { includeDeleted: true });
  };

  schema.statics.findOneWithDeleted = function (filter = {}) {
    return this.findOne(filter, null, { includeDeleted: true });
  };

  schema.statics.hardDelete = function (id) {
    return this.findByIdAndDelete(id, { includeDeleted: true });
  };
}

module.exports = softDeletePlugin;
