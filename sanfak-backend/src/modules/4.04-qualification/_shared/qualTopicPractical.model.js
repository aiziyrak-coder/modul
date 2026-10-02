const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const QualTopicPracticalSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    file: {
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

QualTopicPracticalSchema.plugin(mongoosePaginate);
QualTopicPracticalSchema.plugin(aggregatePaginate);

const model = mongoose.model("qualTopicPractical", QualTopicPracticalSchema);

module.exports = model;
