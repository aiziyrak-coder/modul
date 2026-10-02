const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const QualTopicLectureSchema = new mongoose.Schema(
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

QualTopicLectureSchema.plugin(mongoosePaginate);
QualTopicLectureSchema.plugin(aggregatePaginate);

const model = mongoose.model("qualTopicLecture", QualTopicLectureSchema);

module.exports = model;
