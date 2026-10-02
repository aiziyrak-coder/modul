"use strict";
const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const StudentSchema = new mongoose.Schema(
  {
    firstName:  { type: String, required: true, trim: true },
    lastName:   { type: String, required: true, trim: true },
    middleName: { type: String, default: null,  trim: true },

    photo:     { type: String, default: null },
    birthDate: { type: Date,   default: null },
    gender: {
      type: String,
      enum: ["male", "female"],
      default: "male",
    },

    passportSeries:   { type: String, default: null },
    passportNumber:   { type: String, default: null },
    passportIssuedBy: { type: String, default: null },
    passportIssuedAt: { type: Date,   default: null },
    passportExpiry:   { type: Date,   default: null },
    jshshir:          { type: String, default: null },

    phone:   { type: String, default: null },
    email:   { type: String, default: null },
    address: {
      region:   { type: String, default: null },
      district: { type: String, default: null },
      street:   { type: String, default: null },
    },

    studentId: {
      type: String,
      unique: true,
      sparse: true,
      default: null,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "group",
      default: null,
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "faculty",
      default: null,
    },
    direction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "direction",
      default: null,
    },
    course: {
      type: Number,
      min: 1,
      max: 8,
      default: 1,
    },
    semester: {
      type: Number,
      min: 1,
      max: 16,
      default: 1,
    },
    enrollmentYear: { type: Number, default: null },

    studyType: {
      type: String,
      enum: ["grant", "contract"],
      default: "contract",
    },
    educationForm: {
      type: String,
      enum: ["kunduzgi", "kechki", "sirtqi", "masofaviy"],
      default: "kunduzgi",
    },

    status: {
      type: String,
      enum: ["active", "leave", "expelled", "graduated", "transferred"],
      default: "active",
    },
    statusChangedAt:     { type: Date,   default: null },
    statusChangeReason:  { type: String, default: null },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },

    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

StudentSchema.index({ group: 1, status: 1 });
StudentSchema.index({ faculty: 1 });
StudentSchema.index({ direction: 1 });
StudentSchema.index({ lastName: 1, firstName: 1 });

StudentSchema.plugin(mongoosePaginate);
StudentSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("student", StudentSchema);
