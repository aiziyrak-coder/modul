const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const QUESTION_TYPES = {
  CHOICE: 1,
  RATING: 2,
  TEXT: 3,
};

const QualSurveySchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
    },
    type: {
      type: Number,
      enum: Object.values(QUESTION_TYPES),
      default: QUESTION_TYPES.CHOICE,
    },
    options: {
      type: [
        {
          _id: false,
          text: { type: String, required: true },
        },
      ],
      default: [],
    },
    required: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true, versionKey: false },
);

QualSurveySchema.index({ order: 1 });

QualSurveySchema.plugin(mongoosePaginate);
QualSurveySchema.plugin(aggregatePaginate);

const model = mongoose.model("qualSurvey", QualSurveySchema);

module.exports = model;
module.exports.QUESTION_TYPES = QUESTION_TYPES;
