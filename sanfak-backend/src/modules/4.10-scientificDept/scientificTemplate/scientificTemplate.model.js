const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const TEMPLATE_CATEGORIES = ["methodical", "monograph"];

const ScientificTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    category: {
      type: String,
      enum: TEMPLATE_CATEGORIES,
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    fileName: {
      type: String,
      default: "",
    },
    fileSize: {
      type: String,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true, versionKey: false },
);

ScientificTemplateSchema.plugin(mongoosePaginate);

const model = mongoose.model("scientificTemplate", ScientificTemplateSchema);
model.TEMPLATE_CATEGORIES = TEMPLATE_CATEGORIES;

module.exports = model;
