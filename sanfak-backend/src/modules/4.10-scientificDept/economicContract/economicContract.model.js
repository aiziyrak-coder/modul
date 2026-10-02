const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const CONTRACT_FILE_SLOTS = ["order", "contract", "receipt"];

const CONTRACT_STATUSES = ["new", "approved", "rejected"];

const EconomicContractSchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "department",
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "faculty",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },

    title: { type: String, required: true, trim: true },
    partnerOrganization: { type: String, required: true, trim: true },
    contractDate: { type: Date, required: true },
    amount: { type: Number, required: true, default: 0, min: 0 },
    currentYearAmount: { type: Number, default: 0, min: 0 },

    files: {
      order: { type: String, default: "" },
      contract: { type: String, default: "" },
      receipt: { type: String, default: "" },
    },

    status: {
      type: String,
      enum: CONTRACT_STATUSES,
      default: "new",
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    approvedAt: { type: Date },
    rejectionReason: { type: String },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    rejectedByRole: { type: String, default: "" },

    academicYear: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "academicYear",
      default: null,
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

EconomicContractSchema.plugin(mongoosePaginate);
EconomicContractSchema.plugin(aggregatePaginate);

const model = mongoose.model("economicContract", EconomicContractSchema);
model.CONTRACT_FILE_SLOTS = CONTRACT_FILE_SLOTS;
model.CONTRACT_STATUSES = CONTRACT_STATUSES;

module.exports = model;
