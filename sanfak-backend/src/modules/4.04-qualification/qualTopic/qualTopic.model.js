const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const QualTopicSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    code: {
      type: String,
      trim: true,
      default: "",
    },
    orderNumber: {
      type: Number,
      required: true,
    },
    kind: {
      type: Number,
      required: true,
    },
    duration: {
      type: Number,
      required: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "qualCourse",
      required: true,
    },
    finalTest: {
      type: {
        passPercentage: {
          type: Number,
          default: 60,
        },
        totalQuestions: {
          type: Number,
          default: 10,
        },
        duration: {
          type: Number,
          default: 10,
        },
      },
      default: {},
    },
  },
  { timestamps: true, versionKey: false },
);

QualTopicSchema.plugin(mongoosePaginate);
QualTopicSchema.plugin(aggregatePaginate);

const model = mongoose.model("qualTopic", QualTopicSchema);

module.exports = model;
