const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const QualFinalTestResultSchema = new mongoose.Schema(
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
    passPercentage: {
      type: Number,
      required: true,
    },
    totalQuestions: {
      type: Number,
      required: true,
    },
    totalCorrects: {
      type: Number,
      required: true,
    },
    isPassed: {
      type: Boolean,
      required: true,
    },
    questions: {
      type: [
        {
          isSelectedCorrect: {
            type: Boolean,
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
                  default: false,
                },
                isSelected: {
                  type: Boolean,
                  default: false,
                },
              },
            ],
            required: true,
          },
        },
      ],
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    finishedDate: {
      type: Date,
    },
    status: {
      type: Number,
      default: 1,
    },
  },
  { timestamps: true, versionKey: false },
);

QualFinalTestResultSchema.plugin(mongoosePaginate);
QualFinalTestResultSchema.plugin(aggregatePaginate);

const model = mongoose.model("qualFinalTestResult", QualFinalTestResultSchema);

module.exports = model;
