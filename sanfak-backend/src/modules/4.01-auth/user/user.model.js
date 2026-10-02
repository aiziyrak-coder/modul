const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const UserSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    middleName: {
      type: String,
      default: null,
    },
    passportNumber: {
      type: String,
      default: null,
    },
    passportSeria: {
      type: String,
      default: null,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "department",
      default: null,
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "faculty",
      default: null,
    },
    position: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "position",
      default: null,
    },
    division: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "division",
      default: null,
    },
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "role",
      default: null,
    },
    academicTitle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "academicTitle",
      default: null,
    },
    email: {
      type: String,
      default: null,
    },
    phone: {
      type: String,
      default: null,
    },
    photo: {
      type: String,
      default: null,
    },
    oneIdPin: {
      type: String,
      default: null,
      select: false,
    },
    eriCertificate: {
      type: {
        serialNumber: { type: String },
        validFrom: { type: Date },
        validTo: { type: Date },
        issuedBy: { type: String },
      },
      default: null,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    refreshToken: {
      type: String,
      default: null,
      select: false,
    },
    refreshTokenHash: {
      type: String,
      default: null,
      select: false,
    },
    refreshTokenPrevHash: {
      type: String,
      default: null,
      select: false,
    },
    refreshTokenRotatedAt: {
      type: Date,
      default: null,
      select: false,
    },
    date: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
    active: {
      type: Boolean,
      default: false,
    },
    degrees: {
      bachelorDegree: [
        {
          title: { type: String },
          path: { type: String },
        },
      ],
      masterDegree: [
        {
          title: { type: String },
          path: { type: String },
        },
      ],
      scientificDegree: [
        {
          title: { type: String },
          path: { type: String },
        },
      ],
      scientificTitle: [
        {
          title: { type: String },
          path: { type: String },
        },
      ],
    },
    googleScholar: {
      type: String,
    },
    scopus: {
      type: String,
    },
    publications: {
      type: Number,
      default: null,
    },
    hIndex: {
      type: Number,
      default: null,
    },
    workingHours: {
      type: String,
      default: null,
    },
    workingSchedule: [
      {
        _id: false,
        day: { type: Number, min: 1, max: 7 },
        from: { type: String },
        to: { type: String },
      },
    ],
    lastSeen: { type: Date, default: null },
    office: {
      type: String,
      default: null,
    },
    telegramChatId: {
      type: String,
      default: null,
    },
    employmentType: {
      type: String,
      enum: ["asosiy", "orindosh", null],
      default: null,
    },
    stake: {
      type: Number,
      default: 1.0,
      min: 0,
      max: 2.0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

UserSchema.plugin(mongoosePaginate);
UserSchema.plugin(aggregatePaginate);

UserSchema.index(
  { oneIdPin: 1 },
  {
    unique: true,
    partialFilterExpression: { oneIdPin: { $type: "string" } },
    name: "oneIdPin_unique_partial",
  },
);

module.exports = mongoose.model("user", UserSchema);
