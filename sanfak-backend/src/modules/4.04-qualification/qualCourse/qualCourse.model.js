const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const QualCourseSchema = new mongoose.Schema(
  {
    courseType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "qualCourseType",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    creditHours: {
      type: Number,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    form: {
      type: Number,
      required: true,
    },
    listenersLimit: {
      type: Number,
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
    address: {
      type: String,
    },
    location: {
      type: {
        lat: {
          type: String,
        },
        lng: {
          type: String,
        },
      },
    },
    teachers: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
      required: true,
    },
    status: {
      type: Number,
      default: 1,
    },
    accessTest: {
      type: {
        randomQuestions: {
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
    exitTest: {
      type: {
        passPercentage: {
          type: Number,
          default: 60,
        },
        randomQuestions: {
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
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true, versionKey: false },
);

QualCourseSchema.plugin(mongoosePaginate);
QualCourseSchema.plugin(aggregatePaginate);

const model = mongoose.model("qualCourse", QualCourseSchema);

module.exports = model;
