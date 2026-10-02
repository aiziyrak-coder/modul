const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const ARTICLE_TYPES = ["scopus", "wos", "nationalOak", "foreignOak"];
const ARTICLE_STATUSES = ["new", "pending", "approved", "rejected"];

const ArticleSchema = new mongoose.Schema(
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
    journal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "oakJournal",
    },
    journalName: {
      type: String,
      required: true,
    },
    title: {
      type: String,
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
    type: {
      type: String,
      enum: ARTICLE_TYPES,
      required: true,
    },
    status: {
      type: String,
      enum: ARTICLE_STATUSES,
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

ArticleSchema.plugin(mongoosePaginate);
ArticleSchema.plugin(aggregatePaginate);

const model = mongoose.model("article", ArticleSchema);
model.ARTICLE_TYPES = ARTICLE_TYPES;
model.ARTICLE_STATUSES = ARTICLE_STATUSES;

module.exports = model;
