const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const softDeletePlugin = require("#shared/softDeletePlugin");
const academicYearRefPlugin = require("#modules/4.05-residency/_services/academicYearRefPlugin");
const {
  targetCoursesRefPlugin,
} = require("#modules/4.05-residency/_services/courseRefPlugin");

const AUDIENCES = ["umumiy", "magistratura", "ordinatura", "kafedra_mudirlari"];

const AttachmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    size: { type: String },
    type: { type: String },
    bytes: { type: Number, required: true, min: 0 },
    mimeType: { type: String, required: true },
    storageKey: { type: String, required: true },
    checksum: { type: String, required: true },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },
    uploadedByName: { type: String, default: null },
    uploadedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

AttachmentSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.storageKey;
    return ret;
  },
});

const ResidencyAnnouncementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    audience: {
      type: String,
      enum: AUDIENCES,
      default: "umumiy",
      required: true,
      index: true,
    },
    academicYear: { type: String, default: null, index: true },
    academicYearRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "academicYear",
      default: null,
      index: true,
    },
    deadline: { type: Date, default: null },

    targetCourses: { type: [Number], default: [] },
    targetCoursesRef: [{ type: mongoose.Schema.Types.ObjectId, ref: "course" }],
    targetSpecialties: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "residencySpecialty" }],
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },
    createdByName: { type: String, default: null },
    active: { type: Boolean, default: true },

    attachments: { type: [AttachmentSchema], default: [] },
  },
  { timestamps: true, versionKey: false },
);

ResidencyAnnouncementSchema.plugin(mongoosePaginate);
ResidencyAnnouncementSchema.plugin(softDeletePlugin);

ResidencyAnnouncementSchema.plugin(academicYearRefPlugin);

ResidencyAnnouncementSchema.plugin(targetCoursesRefPlugin);

const ResidencyAnnouncementModel = mongoose.model(
  "residencyAnnouncement",
  ResidencyAnnouncementSchema,
);

module.exports = ResidencyAnnouncementModel;
module.exports.AUDIENCES = AUDIENCES;
module.exports.AttachmentSchema = AttachmentSchema;
