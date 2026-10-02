const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const StartupTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true, versionKey: false },
);

StartupTypeSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("startupType", StartupTypeSchema);
