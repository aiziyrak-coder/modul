const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const WorkDocumentTypeSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    labelUz: { type: String, required: true, trim: true },
    labelRu: { type: String, default: null, trim: true },
    format: { type: String, default: "pdf", trim: true },
    required: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
);

WorkDocumentTypeSchema.plugin(mongoosePaginate);
WorkDocumentTypeSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("sciWorkDocumentType", WorkDocumentTypeSchema);
