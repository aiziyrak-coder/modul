const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const AdmissionEducationLanguageSchema = new mongoose.Schema(
  {
    titleUz: { type: String, required: true, trim: true },
    titleRu: { type: String, required: true, trim: true },
    titleEn: { type: String, required: true, trim: true },

    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

AdmissionEducationLanguageSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("admissionEducationLanguage", AdmissionEducationLanguageSchema);
