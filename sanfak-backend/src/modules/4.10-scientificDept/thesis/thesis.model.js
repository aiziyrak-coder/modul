const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const THESIS_TYPES = ["national", "international"];
const THESIS_STATUSES = ["new", "pending", "approved", "rejected"];

const ThesisSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "department",
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "faculty",
    },
    conferenceName: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: THESIS_TYPES,
      required: true,
    },
    academicYear: {
      type: String,
    },
    publishedDate: {
      type: String,
      trim: true,
      default: "",
    },
    year: {
      type: Number,
    },
    pages: {
      type: String,
    },
    url: {
      type: String,
    },
    authorCount: {
      type: Number,
      min: 1,
    },
    fileUrl: {
      type: String,
    },
    status: {
      type: String,
      enum: THESIS_STATUSES,
      default: "new",
    },
    rejectionReason: {
      type: String,
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
    rejectedByRole: {
      type: String,
      default: "",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
    approvedAt: {
      type: Date,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true, versionKey: false },
);

ThesisSchema.plugin(mongoosePaginate);
ThesisSchema.plugin(aggregatePaginate);

const model = mongoose.model("thesis", ThesisSchema);
model.THESIS_TYPES = THESIS_TYPES;
model.THESIS_STATUSES = THESIS_STATUSES;

module.exports = model;
