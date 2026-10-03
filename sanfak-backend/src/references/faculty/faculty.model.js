const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const FacultySchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    desc: { type: String, default: null },
    date: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
    active: { type: Boolean, default: true },
    hemisId: { type: Number, default: null }, // HEMIS bo'limi id si (sinxron kaliti)
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

FacultySchema.plugin(mongoosePaginate);
FacultySchema.plugin(aggregatePaginate);

module.exports = mongoose.model("faculty", FacultySchema);
