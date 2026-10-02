const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const AdmissionDirectionSchema = new mongoose.Schema(
  {
    titleUz: { type: String, required: true, trim: true },
    titleRu: { type: String, required: true, trim: true },
    titleEn: { type: String, required: true, trim: true },

    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

AdmissionDirectionSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("admissionDirection", AdmissionDirectionSchema);
