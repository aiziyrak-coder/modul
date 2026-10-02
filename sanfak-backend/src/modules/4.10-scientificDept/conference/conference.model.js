const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const CONFERENCE_TYPES = ["national", "international"];

const CONF_DOC_SLOTS = ["thesis", "certificate", "participant", "program"];

const CONF_FILE_TYPES = ["pdf", "word", "excel", "image"];

const RequiredDocSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    fileType: { type: String, enum: CONF_FILE_TYPES, default: "pdf" },
  },
  { _id: false },
);

const UploadedDocSchema = new mongoose.Schema(
  {
    label: { type: String, default: "" },
    fileType: { type: String, default: "pdf" },
    fileUrl: { type: String, default: "" },
  },
  { _id: false },
);

const KAFEDRA_STATUSES = ["pending", "accepted"];

const KafedraStatusSchema = new mongoose.Schema(
  {
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "department",
      required: true,
    },
    status: {
      type: String,
      enum: KAFEDRA_STATUSES,
      default: "pending",
    },
    acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    acceptedAt: { type: Date },
    docs: [UploadedDocSchema],

    documents: {
      thesis: { type: String, default: "" },
      certificate: { type: String, default: "" },
      participant: { type: String, default: "" },
      program: { type: String, default: "" },
    },
  },
  { _id: false },
);

const ConferenceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: CONFERENCE_TYPES,
      default: "national",
    },
    description: { type: String, default: "", trim: true },

    deadline: { type: Date, required: true },
    beforeDeadline: { type: Date },
    afterDeadline: { type: Date },

    requiredDocs: [RequiredDocSchema],

    requiredInfo: [{ type: String }],

    files: [{ title: String, fileUrl: String }],

    kafedras: [KafedraStatusSchema],

    status: {
      type: String,
      enum: ["active", "closed"],
      default: "active",
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

ConferenceSchema.plugin(mongoosePaginate);
ConferenceSchema.plugin(aggregatePaginate);

const model = mongoose.model("conference", ConferenceSchema);
model.CONFERENCE_TYPES = CONFERENCE_TYPES;
model.CONF_DOC_SLOTS = CONF_DOC_SLOTS;
model.CONF_FILE_TYPES = CONF_FILE_TYPES;

module.exports = model;
