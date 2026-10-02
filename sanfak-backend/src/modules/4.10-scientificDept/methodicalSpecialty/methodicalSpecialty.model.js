const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const MethodicalSpecialtySchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
    },
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

MethodicalSpecialtySchema.plugin(mongoosePaginate);

module.exports = mongoose.model("methodicalSpecialty", MethodicalSpecialtySchema);
