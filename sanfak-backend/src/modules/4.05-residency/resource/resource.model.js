const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const softDeletePlugin = require("#shared/softDeletePlugin");

const RESOURCE_TYPES = [
  "kitob",
  "atlas",
  "video",
  "metodik",
  "protokol",
  "qollanma",
];

const LEGACY_CATEGORIES = ["video", "presentation", "lecture", "image"];

const ResourceSchema = new mongoose.Schema(
  {
    department: { type: mongoose.Schema.Types.ObjectId, ref: "department" },
    title: { type: String, required: true },
    category: { type: String, enum: LEGACY_CATEGORIES },
    resourceType: {
      type: String,
      enum: RESOURCE_TYPES,
      default: "kitob",
      index: true,
    },
    specialty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "residencySpecialty",
      default: null,
      index: true,
    },
    specialtyTitle: { type: String, default: null },
    author: { type: String, default: null },
    publishYear: { type: Number, default: null },
    desc: { type: String, default: null },
    fileUrl: { type: String, required: true },
    fileName: { type: String, default: null },
    fileSize: { type: Number, default: null },
    format: { type: String, default: null },
    downloadCount: { type: Number, default: 0 },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

ResourceSchema.plugin(mongoosePaginate);
ResourceSchema.plugin(aggregatePaginate);
ResourceSchema.plugin(softDeletePlugin);

const ResourceModel = mongoose.model("resource", ResourceSchema);

module.exports = ResourceModel;
module.exports.RESOURCE_TYPES = RESOURCE_TYPES;
