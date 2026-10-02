const mongoose = require("mongoose");

const PLAN_STATUSES = [
  "yangi",
  "yuborilgan",
  "jarayonda",
  "rad_etilgan",
  "bajarilgan",
];

const APPROVAL_ROLES = ["magistratura_bolim", "ilmiy_rahbar", "kafedra_mudiri"];

const ACTIVITY_CATEGORIES = [
  "oquv_metodik",
  "ilmiy_tadqiqot",
  "ilmiy_pedagogik",
  "pedagogik_amaliyot",
];

const DISSERTATION_STAGES = [
  "tayyorgarlik",
  "rejalashtirish",
  "amalga_oshirish",
  "rasmiylashtirish",
  "himoya",
];

const PROOF_STATUSES = ["pending", "approved", "rejected"];

const ProofSchema = new mongoose.Schema(
  {
    fileUrl: { type: String, default: null },
    url: { type: String, default: null },
    comment: { type: String, default: null },
    createdAt: { type: Date, default: () => new Date() },

    workDate: { type: Date, default: null },

    lateUpload: { type: Boolean, default: false },
    status: { type: String, enum: PROOF_STATUSES, default: "pending" },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },
    reviewedAt: { type: Date, default: null },
    reviewComment: { type: String, default: null },
  },
  { _id: false },
);

const TaskSchema = new mongoose.Schema(
  {
    category: { type: String, required: true },
    title: { type: String, required: true },
    targetCount: { type: Number, default: 1 },
    dueDate: { type: Date, default: null },
    proofs: { type: [ProofSchema], default: [] },
  },
  { _id: false },
);

const ApprovalSchema = new mongoose.Schema(
  {
    role: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    signedAt: { type: Date, default: () => new Date() },
    eriKey: { type: String, default: null },

    eriSerialNumber: { type: String, default: null },
    eriSignedAt: { type: Date, default: null },
  },
  { _id: false },
);

module.exports = {
  PLAN_STATUSES,
  APPROVAL_ROLES,
  ACTIVITY_CATEGORIES,
  DISSERTATION_STAGES,
  PROOF_STATUSES,
  ProofSchema,
  TaskSchema,
  ApprovalSchema,
};
