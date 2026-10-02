const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const QualAccessTestResultSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "qualCourse",
      required: true,
    },
    listener: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QualListener",
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
      default: 1
    }
  },
  { timestamps: true, versionKey: false },
);

QualAccessTestResultSchema.plugin(mongoosePaginate);
QualAccessTestResultSchema.plugin(aggregatePaginate);

const model = mongoose.model(
  "qualAccessTestResult",
  QualAccessTestResultSchema,
);

module.exports = model;
