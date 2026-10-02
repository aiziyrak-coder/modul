const mongoose = require("mongoose");

const ResidencyAnnouncementReadSchema = new mongoose.Schema(
  {
    announcement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "residencyAnnouncement",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    readAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

ResidencyAnnouncementReadSchema.index(
  { announcement: 1, user: 1 },
  { unique: true },
);
ResidencyAnnouncementReadSchema.index({ user: 1, announcement: 1 });

module.exports = mongoose.model(
  "residencyAnnouncementRead",
  ResidencyAnnouncementReadSchema,
);
