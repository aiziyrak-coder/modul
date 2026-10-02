const mongoose = require("mongoose");

const QualCertificateCounterSchema = new mongoose.Schema(
  {
    _id: { type: String },
    seq: { type: Number, required: true, default: 0 },
  },
  { versionKey: false, _id: false },
);

module.exports = mongoose.model(
  "qualCertificateCounter",
  QualCertificateCounterSchema,
);
