const mongoose = require("mongoose");

// cam.fermi.uz da TASDIQLANGAN yuz izlari (embedding). Faqat xodim yuzi `user` ga bog'lanadi;
// talaba yuzlari (user = null) faqat "raqib" sifatida solishtirishda ishtirok etadi:
// xodimga o'xshash talaba xodim hisobiga kirib ketmasligi uchun.
const faceTemplateSchema = new mongoose.Schema(
  {
    camPersonId: { type: String, required: true },
    kind: { type: String, enum: ["xodim", "talaba"], required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    embedding: { type: [Number], required: true, select: false },
    active: { type: Boolean, default: true },
    syncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
faceTemplateSchema.index({ camPersonId: 1 }, { unique: true });
faceTemplateSchema.index({ active: 1 });

module.exports =
  mongoose.models.FaceTemplate || mongoose.model("FaceTemplate", faceTemplateSchema);
