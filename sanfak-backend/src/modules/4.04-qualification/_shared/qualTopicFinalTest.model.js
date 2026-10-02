const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const QualTopicFinalTestSchema = new mongoose.Schema(
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
    testType: {
      type: Number,
      default: 1,
    },
    question: {
      type: String,
      required: true,
    },
    options: {
      type: [
        {
          text: {
            type: String,
            required: true,
          },
          isCorrect: {
            type: Boolean,
            required: true,
          },
        },
      ],
      required: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true, versionKey: false },
);

QualTopicFinalTestSchema.plugin(mongoosePaginate);
QualTopicFinalTestSchema.plugin(aggregatePaginate);

const model = mongoose.model("qualTopicFinalTest", QualTopicFinalTestSchema);

module.exports = model;
