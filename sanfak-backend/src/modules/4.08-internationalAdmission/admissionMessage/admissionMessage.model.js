const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const AdmissionMessageSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },

    direction: { type: mongoose.Schema.Types.ObjectId, ref: "admissionDirection", default: null },
    educationLanguage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "admissionEducationLanguage",
      default: null,
    },

    academicYear: { type: String, required: true, trim: true },
    season: { type: String, required: true, trim: true },

    recipientCount: { type: Number, default: 0 },
    deliveredCount: { type: Number, default: 0 },

    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    sentAt: { type: Date, default: Date.now },

    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

AdmissionMessageSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("admissionMessage", AdmissionMessageSchema);
