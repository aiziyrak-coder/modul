const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const SEASON_NAMES = ["bahor", "yoz", "kuz", "qish"];
const SEASON_STATUSES = ["rejada", "ochiq", "yopiq"];

const SeasonItemSchema = new mongoose.Schema(
  {
    direction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "admissionDirection",
      required: true,
    },
    educationForms: [{ type: mongoose.Schema.Types.ObjectId, ref: "admissionEducationForm" }],
    educationLanguages: [
      { type: mongoose.Schema.Types.ObjectId, ref: "admissionEducationLanguage" },
    ],
  },
  { _id: true, versionKey: false },
);

const AdmissionSeasonSchema = new mongoose.Schema(
  {
    titleUz: { type: String, required: true, trim: true },
    titleRu: { type: String, required: true, trim: true },
    titleEn: { type: String, required: true, trim: true },

    descriptionUz: { type: String, default: "", trim: true },
    descriptionRu: { type: String, default: "", trim: true },
    descriptionEn: { type: String, default: "", trim: true },

    academicYear: { type: String, required: true, trim: true },
    season: { type: String, enum: SEASON_NAMES, required: true },

    items: { type: [SeasonItemSchema], default: [] },

    openDate: { type: Date, required: true },
    closeDate: { type: Date, required: true },

    status: { type: String, enum: SEASON_STATUSES, default: "rejada" },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    closedAt: { type: Date },

    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

AdmissionSeasonSchema.plugin(mongoosePaginate);

const model = mongoose.model("admissionSeason", AdmissionSeasonSchema);
model.SEASON_NAMES = SEASON_NAMES;
model.SEASON_STATUSES = SEASON_STATUSES;

module.exports = model;
