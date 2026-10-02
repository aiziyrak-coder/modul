const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const IndicatorSubmissionSchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    indicator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "indicator",
      required: true,
    },
    academicYear: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "academicYear",
      default: null,
    },
    semester: {
      type: Number,
      enum: [1, 2, null],
      default: null,
    },
    data: { type: mongoose.Schema.Types.Mixed },
    files: [{ type: String }],
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    score: { type: Number, default: 0 },
    authorShare: { type: Number, default: 100 },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    comment: { type: String },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

IndicatorSubmissionSchema.plugin(mongoosePaginate);
IndicatorSubmissionSchema.plugin(aggregatePaginate);

module.exports = mongoose.model(
  "indicatorSubmission",
  IndicatorSubmissionSchema,
);
