const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const TaskCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

TaskCategorySchema.plugin(mongoosePaginate);

module.exports = mongoose.model("taskCategory", TaskCategorySchema);
