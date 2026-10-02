const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const DivisionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    desc: { type: String, default: null },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "faculty",
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "department",
    },
    date: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
    active: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

DivisionSchema.plugin(mongoosePaginate);
DivisionSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("division", DivisionSchema);
