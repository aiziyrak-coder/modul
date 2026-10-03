const mongoose = require("mongoose");

// cam.fermi.uz dagi xodim <-> bizning foydalanuvchi bog'lanishi (yuz bilan kirish uchun).
// Yuz vektori (embedding) BU YERDA SAQLANMAYDI — faqat bog'lanish.
const faceLinkSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    camStaffId: { type: String, required: true }, // cam.fermi.uz students_staff.id
    hemisId: { type: String, default: null },
    source: { type: String, enum: ["import", "manual"], default: "import" },
  },
  { timestamps: true },
);
faceLinkSchema.index({ camStaffId: 1 }, { unique: true });
faceLinkSchema.index({ user: 1 });

module.exports = mongoose.models.FaceLink || mongoose.model("FaceLink", faceLinkSchema);
