const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const AdmissionCountrySchema = new mongoose.Schema(
  {
    titleUz: { type: String, required: true, trim: true },
    titleRu: { type: String, required: true, trim: true },
    titleEn: { type: String, required: true, trim: true },

    flagUrl: { type: String, default: "" },
    passportSample: { type: String, default: "", trim: true },
    phoneSample: { type: String, default: "", trim: true },

    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

AdmissionCountrySchema.plugin(mongoosePaginate);

module.exports = mongoose.model("admissionCountry", AdmissionCountrySchema);
