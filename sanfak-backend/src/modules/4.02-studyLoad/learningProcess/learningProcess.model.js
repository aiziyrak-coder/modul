const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const StatisticItemSchema = {
  key: { type: String, default: null },
  slug: { type: String, default: "" },
  title: { type: String, default: "" },
  value: { type: Number, default: 0 },
};

const SummaryRowSchema = new mongoose.Schema(
  {
    key: { type: String, maxlength: 5 },
    title: { type: String, maxlength: 200 },
  },
  { _id: false },
);

const LearningProcessSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: null,
      maxlength: 300,
    },
    direction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "direction",
      required: true,
    },
    academicLevel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "academicLevel",
      required: true,
    },
    readingForm: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "readingForm",
      required: true,
    },
    educationForm: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "educationForm",
      required: true,
    },
    studyPeriod: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "studyPeriod",
      required: true,
    },
    specialization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "specialization",
      required: true,
    },
    year: {
      type: String,
      required: true,
    },
    keys: [
      {
        key: {
          type: String,
          default: " ",
          maxlength: 5,
        },
        title: {
          type: String,
          default: "",
          maxlength: 500,
        },
      },
    ],
    courses: [
      {
        course: { type: String, default: null, minlength: 1, maxlength: 5 },
        courseRef: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "course",
          default: null,
        },
        courseNum: { type: Number, default: 0 },
        months: [
          {
            month: {
              type: String,
              default: null,
              minlength: 3,
              maxlength: 20,
            },
            weeks: [
              {
                week: { type: Number },
                key: {
                  type: String,
                  default: " ",
                  maxlength: 5,
                },
              },
            ],
          },
        ],
        weeks: {
          type: mongoose.Schema.Types.Mixed,
          default: {},
        },
        total: {
          type: Number,
          default: 0,
        },
        statistics: {
          type: [StatisticItemSchema],
          default: [],
        },
      },
    ],
    allValues: {
      total: { type: Number, default: 0 },
      statistics: {
        type: [StatisticItemSchema],
        default: [],
      },
    },
    comment: { type: String, default: null },
    planSource: { type: String, enum: ["institute", "ministry"], default: "institute" },
    basisNote: { type: String, default: null, maxlength: 500 },
    attestationNote: { type: String, default: null, maxlength: 500 },
    summaryRows: { type: [SummaryRowSchema], default: undefined },
    learningProcess: {
      keys: [
        {
          key: {
            type: String,
            default: " ",
            maxlength: 5,
          },
          title: {
            type: String,
            default: "",
            maxlength: 500,
          },
          week: { type: Number, default: 0 },
          semester: { type: String, default: null },
        },
      ],
      title: { type: String, default: null },
    },
    file: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["new", "created"],
      default: "new",
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
    date: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

LearningProcessSchema.plugin(mongoosePaginate);
LearningProcessSchema.plugin(aggregatePaginate);
LearningProcessSchema.plugin(require("#shared/softDeletePlugin"));

module.exports = mongoose.model("learningProcess", LearningProcessSchema);
