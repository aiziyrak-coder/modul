const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const PermissionGroupSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    desc: {
      type: String,
      default: null,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true, versionKey: false },
);

PermissionGroupSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("permissionGroup", PermissionGroupSchema);
