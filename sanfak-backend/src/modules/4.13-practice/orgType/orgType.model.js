const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const OrgTypeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

OrgTypeSchema.plugin(mongoosePaginate);
OrgTypeSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("orgType", OrgTypeSchema);
