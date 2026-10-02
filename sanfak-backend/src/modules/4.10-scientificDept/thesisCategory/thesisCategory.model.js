const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const THESIS_TYPES = ["national", "international"];

const ThesisCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: THESIS_TYPES,
      required: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true, versionKey: false },
);

ThesisCategorySchema.plugin(mongoosePaginate);

const model = mongoose.model("thesisCategory", ThesisCategorySchema);
model.THESIS_TYPES = THESIS_TYPES;

module.exports = model;
