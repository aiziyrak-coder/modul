const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const QualTopicVideoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    videoRaw: {
      type: String,
      required: true,
    },
    fileName: {
      type: String,
      default: null,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "qualCourse",
      required: true,
    },
    topic: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "qualTopic",
      required: true,
    },
  },
  { timestamps: true, versionKey: false },
);

QualTopicVideoSchema.plugin(mongoosePaginate);
QualTopicVideoSchema.plugin(aggregatePaginate);

const model = mongoose.model("qualTopicVideo", QualTopicVideoSchema);

module.exports = model;
