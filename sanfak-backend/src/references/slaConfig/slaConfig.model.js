const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const SlaConfigSchema = new mongoose.Schema(
  {
    role: { type: String, required: true },
    documentType: { type: String, default: null },

    slaDays: { type: Number, required: true, default: 5 },
    warningDaysBefore: { type: Number, default: 1 },

    escalateToRole: { type: String, default: null },
    escalateAfterDays: { type: Number, default: 3 },

    desc: { type: String, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

SlaConfigSchema.index(
  { role: 1, documentType: 1 },
  { unique: true, partialFilterExpression: { active: true } },
);

SlaConfigSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("slaConfig", SlaConfigSchema);
