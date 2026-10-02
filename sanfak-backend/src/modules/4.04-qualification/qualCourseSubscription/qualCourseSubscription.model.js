const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const QualCourseSubscriptionSchema = new mongoose.Schema(
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
    educationType: {
      type: Number,
      default: 2,
    },
  },
  { timestamps: true, versionKey: false },
);

QualCourseSubscriptionSchema.plugin(mongoosePaginate);
QualCourseSubscriptionSchema.plugin(aggregatePaginate);

const model = mongoose.model(
  "qualCourseSubscription",
  QualCourseSubscriptionSchema,
);

module.exports = model;
