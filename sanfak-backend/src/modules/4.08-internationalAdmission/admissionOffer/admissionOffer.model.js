const mongoose = require("mongoose");

const OfferBlockSchema = new mongoose.Schema(
  {
    order: { type: Number, required: true },

    titleUz: { type: String, required: true, trim: true },
    titleRu: { type: String, default: "", trim: true },
    titleEn: { type: String, default: "", trim: true },

    bodyUz: { type: String, default: "", trim: true },
    bodyRu: { type: String, default: "", trim: true },
    bodyEn: { type: String, default: "", trim: true },
  },
  { _id: true, versionKey: false },
);

const AdmissionOfferSchema = new mongoose.Schema(
  {
    blocks: { type: [OfferBlockSchema], default: [] },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

module.exports = mongoose.model("admissionOffer", AdmissionOfferSchema);
