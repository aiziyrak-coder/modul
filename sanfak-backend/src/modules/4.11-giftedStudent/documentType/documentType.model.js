const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const softDeletePlugin = require("#shared/softDeletePlugin");

const DocumentTypeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    desc: { type: String, default: null },
    active: { type: Boolean, default: true },
    personal: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false },
);

DocumentTypeSchema.plugin(mongoosePaginate);
DocumentTypeSchema.plugin(aggregatePaginate);
DocumentTypeSchema.plugin(softDeletePlugin);

module.exports = mongoose.model("documentType", DocumentTypeSchema);
