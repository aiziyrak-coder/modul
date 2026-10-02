const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const RoleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      unique: true,
    },
    desc: {
      type: String,
      default: "",
    },
    permissions: [
      {
        section: { type: String },
        actionKeys: { type: [String] },
      },
    ],
    scopeLevel: {
      type: String,
      enum: ["global", "faculty", "department", "self"],
      default: "self",
    },
    isSystem: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

RoleSchema.plugin(mongoosePaginate);
RoleSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("role", RoleSchema);
