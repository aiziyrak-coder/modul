const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const ParticleItemSchema = new mongoose.Schema({
  slug: { type: String, default: "" },
  slugRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "educationActivityType",
    default: null,
  },
  title: { type: String, default: "" },
  value: { type: Number, default: 0 },
  canonical: { type: String, default: null },
  colNum: { type: Number, default: null },
});

const SemesterSchema = new mongoose.Schema({
  hour: { type: Number, default: 0 },
  credit: { type: Number, default: 0 },
  particles: { type: [ParticleItemSchema], default: [] },
  weeklyHours: { type: Number, default: 0 },
  assessmentType: { type: String, default: null },
});

const ParticleLabelSchema = new mongoose.Schema({
  slug: { type: String, default: "" },
  slugRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "educationActivityType",
    default: null,
  },
  title: { type: String, default: "" },
  colNum: { type: Number, default: null },
});

const ParticlesMetaSchema = new mongoose.Schema({
  title: { type: String, default: "" },
  items: { type: [ParticleLabelSchema], default: [] },
});

const DistributionMetaSchema = new mongoose.Schema({
  title: { type: String, default: "" },
  courses: [{ type: String }],
  weekly: [{ type: Number }],
  semester: [{ type: Number }],
  audience: [{ type: Number }],
  semesterColNums: [{ type: Number }],
  courseColNums: [{ type: Number }],
});

const CreditMetaSchema = new mongoose.Schema({
  title: { type: String, default: "" },
  courses: [{ type: String }],
  weekly: [{ type: Number }],
  semester: [{ type: Number }],
  distribution: [{ type: Number }],
  semesterColNums: [{ type: Number }],
  courseColNums: [{ type: Number }],
});

const ColumnsSchema = new mongoose.Schema({
  serialNumber: { type: Number, default: null },
  code: { type: Number, default: null },
  title: { type: Number, default: null },
  totalCredit: { type: Number, default: null },
  distributionStart: { type: Number, default: null },
  distributionEnd: { type: Number, default: null },
  creditStart: { type: Number, default: null },
  creditEnd: { type: Number, default: null },
});

const MetaSchema = new mongoose.Schema({
  serialNumber: { type: String, default: null },
  code: { type: String, default: null },
  title: { type: String, default: null },
  particles: { type: ParticlesMetaSchema, default: () => ({}) },
  distribution: { type: DistributionMetaSchema, default: () => ({}) },
  credit: { type: CreditMetaSchema, default: () => ({}) },
  totalCredit: { type: String, default: null },
  columns: { type: ColumnsSchema, default: () => ({}) },
  tartibRow: { type: [Number], default: [] },
});

const AlternativeScienceSchema = new mongoose.Schema(
  {
    science: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "science",
      default: null,
    },
    code: { type: String, default: null },
    title: { type: String, default: null },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "department",
      default: null,
    },
  },
  { _id: false },
);

const ScienceSchema = new mongoose.Schema({
  serialNumber: { type: String, default: null },
  code: { type: String, default: null },
  title: { type: String, default: null },
  science: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "science",
    default: null,
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "department",
    default: null,
  },
  particle: { type: [ParticleItemSchema], default: [] },
  semesters: {
    type: Map,
    of: SemesterSchema,
    default: {},
  },
  totalCredit: { type: Number, default: 0 },
  alternatives: { type: [AlternativeScienceSchema], default: [] },
});

const BlockSchema = new mongoose.Schema({
  blockCode: { type: String, required: true },
  serialNumber: { type: String, default: null },
  code: { type: String, default: null },
  title: { type: String, default: null },
  particle: { type: [ParticleItemSchema], default: [] },
  semesters: {
    type: Map,
    of: SemesterSchema,
    default: {},
  },
  totalCredit: { type: Number, default: 0 },
  sciences: { type: [ScienceSchema], default: [] },
});

const StudyPlanSchema = new mongoose.Schema(
  {
    learningProcess: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "learningProcess",
      required: true,
    },
    meta: { type: MetaSchema, default: () => ({}) },
    blocks: { type: [BlockSchema], default: [] },
    file: { type: String },
    date: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
    status: {
      type: String,
      enum: ["new", "created"],
      default: "new",
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

StudyPlanSchema.plugin(mongoosePaginate);
StudyPlanSchema.plugin(aggregatePaginate);

StudyPlanSchema.pre("save", async function (next) {
  try {
    const { resolveOrCreate } = require("#references/_services/educationActivityResolver");

    const cache = new Map();
    const resolve = async (title) => {
      if (!title) return null;
      if (cache.has(title)) return cache.get(title);
      const id = await resolveOrCreate(title);
      cache.set(title, id);
      return id;
    };

    const fillItems = async (items) => {
      if (!Array.isArray(items)) return;
      for (const item of items) {
        if (item?.title && !item.slugRef) {
          item.slugRef = await resolve(item.title);
        }
      }
    };

    await fillItems(this.meta?.particles?.items);

    if (Array.isArray(this.blocks)) {
      for (const block of this.blocks) {
        await fillItems(block.particle);

        if (block.semesters) {
          for (const sem of block.semesters.values()) {
            await fillItems(sem.particles);
          }
        }

        if (Array.isArray(block.sciences)) {
          for (const sci of block.sciences) {
            await fillItems(sci.particle);

            if (sci.semesters) {
              for (const sem of sci.semesters.values()) {
                await fillItems(sem.particles);
              }
            }
          }
        }
      }
    }

    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("studyPlan", StudyPlanSchema);
