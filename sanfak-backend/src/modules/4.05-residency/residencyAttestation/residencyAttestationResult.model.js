const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const softDeletePlugin = require("#shared/softDeletePlugin");

const ResidencyAttestationResultSchema = new mongoose.Schema(
  {
    attestation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "residencyAttestation",
      required: true,
      index: true,
    },
    resident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "resident",
      required: true,
      index: true,
    },
    residentName: { type: String, default: null },
    score: { type: Number, default: null, min: 0, max: 100 },
    included: { type: Boolean, default: true },
    excludeReason: { type: String, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

ResidencyAttestationResultSchema.index(
  { attestation: 1, resident: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

ResidencyAttestationResultSchema.plugin(mongoosePaginate);
ResidencyAttestationResultSchema.plugin(softDeletePlugin);

module.exports = mongoose.model(
  "residencyAttestationResult",
  ResidencyAttestationResultSchema,
);
