const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const NotificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },

    eventType: {
      type: String,
      required: true,
      index: true,
    },

    title: { type: String, required: true },
    body: { type: String, default: null },
    link: { type: String, default: null },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },

    channels: [
      {
        type: String,
        enum: ["inApp", "telegram", "email", "sms"],
      },
    ],

    deliveryStatus: {
      inApp:    { delivered: Boolean, error: String },
      telegram: { delivered: Boolean, error: String },
      email:    { delivered: Boolean, error: String },
      sms:      { delivered: Boolean, error: String },
    },

    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

NotificationSchema.index({ user: 1, read: 1, createdAt: -1 });

NotificationSchema.plugin(mongoosePaginate);
NotificationSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("notification", NotificationSchema);
