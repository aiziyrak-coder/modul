const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const QualSurveyAnswerSchema = new mongoose.Schema(
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
    answers: {
      type: [
        {
          _id: false,
          question: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "qualSurvey",
            required: true,
          },
          optionIndex: { type: Number },
          rating: { type: Number, min: 1, max: 5 },
          text: { type: String },
        },
      ],
      default: [],
    },
  },
  { timestamps: true, versionKey: false },
);

QualSurveyAnswerSchema.index({ course: 1, listener: 1 }, { unique: true });

QualSurveyAnswerSchema.plugin(mongoosePaginate);
QualSurveyAnswerSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("qualSurveyAnswer", QualSurveyAnswerSchema);
