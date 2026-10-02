const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const ApprovalChainSchema = new mongoose.Schema(
  {
    document: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    documentType: {
      type: String,
      required: true,
    },
    moduleName: {
      type: String,
      required: true,
    },
    steps: [
      {
        order: { type: Number },
        roleTitle: { type: String },
        user: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
        status: {
          type: String,
          enum: ["pending", "approved", "rejected", "returned"],
          default: "pending",
        },
        eriSignature: { type: String },
        comment: { type: String },
        signedAt: { type: Date },

        slaDays: { type: Number, default: 5 },
        startedAt: { type: Date, default: null },
        deadline: { type: Date, default: null },
        overdue: { type: Boolean, default: false },
        notifiedAt: { type: Date, default: null },

        escalated: { type: Boolean, default: false },
        escalatedAt: { type: Date, default: null },
        escalatedTo: { type: String, default: null },
      },
    ],
    currentStep: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "returned"],
      default: "pending",
    },
    active: { type: Boolean, default: true },

    currentStepStartedAt: { type: Date, default: null },
    currentStepDeadline: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

ApprovalChainSchema.plugin(mongoosePaginate);
ApprovalChainSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("approvalChain", ApprovalChainSchema);
