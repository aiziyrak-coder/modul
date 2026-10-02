const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const softDeletePlugin = require("#shared/softDeletePlugin");
const academicYearRefPlugin = require("#modules/4.05-residency/_services/academicYearRefPlugin");
const {
  PLAN_STATUSES,
  TaskSchema,
  ApprovalSchema,
} = require("#modules/4.05-residency/_services/workPlanSchemas");

const DissertationPlanSchema = new mongoose.Schema(
  {
    resident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "resident",
      required: true,
      index: true,
    },
    supervisor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
      index: true,
    },
    title: { type: String, required: true },
    academicYear: { type: String, default: null },
    academicYearRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "academicYear",
      default: null,
      index: true,
    },
    tasks: { type: [TaskSchema], default: [] },
    status: {
      type: String,
      enum: PLAN_STATUSES,
      default: "yangi",
      index: true,
    },
    approvals: { type: [ApprovalSchema], default: [] },
    rejectionReason: { type: String, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

DissertationPlanSchema.plugin(mongoosePaginate);
DissertationPlanSchema.plugin(aggregatePaginate);
DissertationPlanSchema.plugin(softDeletePlugin);

DissertationPlanSchema.plugin(academicYearRefPlugin);

module.exports = mongoose.model(
  "residencyDissertationPlan",
  DissertationPlanSchema,
);
