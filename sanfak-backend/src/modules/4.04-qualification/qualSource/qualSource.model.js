const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const QualSourceSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "qualCourse",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    link: {
      type: String,
      default: null,
    },
    file: {
      type: String,
      required: true,
    },
    fileDetails: {
      type: {
        name: {
          type: String,
          required: true,
        },
      },
      required: true,
    },
  },
  { timestamps: true, versionKey: false },
);

QualSourceSchema.plugin(mongoosePaginate);
QualSourceSchema.plugin(aggregatePaginate);

const model = mongoose.model("qualSource", QualSourceSchema);

module.exports = model;
