const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const QualExitTestSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "qualCourse",
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

QualExitTestSchema.plugin(mongoosePaginate);
QualExitTestSchema.plugin(aggregatePaginate);

const model = mongoose.model("qualExitTest", QualExitTestSchema);

module.exports = model;
