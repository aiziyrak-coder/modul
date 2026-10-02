const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const QualTopicCompletionSchema = new mongoose.Schema(
  {
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
    listener: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QualListener",
      required: true,
    },
    startedAt: {
      type: Date,
      required: true,
    },
    status: {
      type: Number,
      required: true,
    },
    isLocked: {
      type: Number,
      default: false,
    },
    scenarioAnswer: {
      type: String,
    },
    scenarioImage: {
      type: String,
    },
  },
  { timestamps: true, versionKey: false },
);

QualTopicCompletionSchema.plugin(mongoosePaginate);
QualTopicCompletionSchema.plugin(aggregatePaginate);

const model = mongoose.model("qualTopicCompletion", QualTopicCompletionSchema);

module.exports = model;
