const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const DirectionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    desc: { type: String, default: null },
    directionCode: { type: String, default: null },

    knowledgeArea: { type: String, default: null },
    educationArea: { type: String, default: null },

    level: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "academicLevel",
      default: null,
    },

    readingFormat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "readingForm",
      default: null,
    },

    educationForm: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "educationForm",
      default: null,
    },

    studyPeriod: { type: Number, default: null },

    specialization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "specialization",
      default: null,
    },

    international: { type: Boolean, default: false, index: true },

    teachingLanguages: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "languageOfInstruction",
        },
      ],
      default: [],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "Kamida bitta ta'lim tili tanlanishi kerak",
      },
    },

    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "faculty",
    },
    practiceDepartment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "department",
      default: null,
    },
    date: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
    active: { type: Boolean, default: true },
    hemisId: { type: Number, default: null }, // HEMIS yo'nalish id si
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

DirectionSchema.plugin(mongoosePaginate);
DirectionSchema.plugin(aggregatePaginate);

module.exports = mongoose.model("direction", DirectionSchema);
