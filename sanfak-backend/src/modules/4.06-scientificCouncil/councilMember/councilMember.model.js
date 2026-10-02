const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const ExternalMemberSchema = new mongoose.Schema(
  {
    name: { type: String },
    workplace: { type: String },
    position: { type: String },
    passportSeries: { type: String },
    passportNumber: { type: String },
    email: { type: String },
    phone: { type: String },
  },
  { _id: false },
);

const CouncilMemberSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["internal", "external"],
      default: "internal",
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      unique: true,
      sparse: true,
    },
    external: { type: ExternalMemberSchema, default: undefined },
    academicTitle: { type: String },
    degree: { type: String },
    specialties: [
      { type: mongoose.Schema.Types.ObjectId, ref: "sciCouncilSpecialty" },
    ],
    organization: { type: String },
    assignedCount: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

CouncilMemberSchema.plugin(mongoosePaginate);
CouncilMemberSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("sciCouncilMember", CouncilMemberSchema);
