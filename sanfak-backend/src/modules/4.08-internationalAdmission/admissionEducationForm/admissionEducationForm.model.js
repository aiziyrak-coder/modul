const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const AdmissionEducationFormSchema = new mongoose.Schema(
  {
    titleUz: { type: String, required: true, trim: true },
    titleRu: { type: String, required: true, trim: true },
    titleEn: { type: String, required: true, trim: true },

    descriptionUz: { type: String, default: "", trim: true },
    descriptionRu: { type: String, default: "", trim: true },
    descriptionEn: { type: String, default: "", trim: true },

    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

AdmissionEducationFormSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("admissionEducationForm", AdmissionEducationFormSchema);
