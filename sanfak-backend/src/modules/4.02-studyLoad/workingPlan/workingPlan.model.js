const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const {
  buildBlockSerialIndex,
  isDoubleCountedHeader,
} = require("#modules/4.02-studyLoad/_shared/planRowType");

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
  totalCredit: { type: String, default: "Kreditlar" },
  evaluationType: { type: String, default: "Yakuniy baholash turi" },
  weeklyHours: { type: String, default: "Haftalik auditoriya soati" },
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
  totalCredit: { type: Number, default: 0 },
  weeklyHours: { type: Number, default: 0 },
  evaluationType: { type: String, default: null },
  alternatives: { type: [AlternativeScienceSchema], default: [] },
});

const BlockSchema = new mongoose.Schema({
  blockCode: { type: String, required: true },
  serialNumber: { type: String, default: null },
  code: { type: String, default: null },
  title: { type: String, default: null },
  sciences: { type: [ScienceSchema], default: [] },
});

const TotalRowSchema = new mongoose.Schema(
  {
    title: { type: String, default: null },
    totalHour: { type: Number, default: 0 },
    totalCredit: { type: Number, default: 0 },
    weeklyHours: { type: Number, default: 0 },
    particles: { type: [ParticleItemSchema], default: [] },
  },
  { _id: false },
);

const PracticeRowSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: "Malakaviy amaliyot (Tanishuv amaliyoti)",
    },
    code: { type: String, default: null },
    hour: { type: Number, default: 0 },
    credit: { type: Number, default: 0 },
    particles: { type: [ParticleItemSchema], default: [] },
  },
  { _id: false },
);

const SemesterDataSchema = new mongoose.Schema(
  {
    semester: { type: String, default: null },

    blocks: { type: [BlockSchema], default: [] },

    blocksTotal: { type: TotalRowSchema, default: () => ({ title: "Jami" }) },

    practice: { type: PracticeRowSchema, default: () => ({}) },

    grandTotal: {
      type: TotalRowSchema,
      default: () => ({ title: "Jami semestrda" }),
    },
  },
  { _id: false },
);

const WorkingPlanSchema = new mongoose.Schema(
  {
    workingSchedule: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "workingSchedule",
      required: true,
    },
    studyPlan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "studyPlan",
      default: null,
    },
    studyPlanLabel: { type: String, default: null },

    meta: { type: MetaSchema, default: () => ({}) },

    semesters: {
      type: Map,
      of: SemesterDataSchema,
      default: {},
    },

    date: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
    file: { type: String, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

WorkingPlanSchema.index({ workingSchedule: 1 });
WorkingPlanSchema.index({ studyPlan: 1 });

WorkingPlanSchema.plugin(mongoosePaginate);
WorkingPlanSchema.plugin(aggregatePaginate);

function iterMap(mapOrObj) {
  if (!mapOrObj) return [];
  if (mapOrObj instanceof Map) return [...mapOrObj.entries()];
  return Object.entries(mapOrObj);
}

function computeSemesterTotals(
  semesterData,
  isLastSemester = false,
  blockSerialIndex = null,
) {
  const blocks = semesterData.blocks || [];
  const serialIndex =
    blockSerialIndex || buildBlockSerialIndex({ current: semesterData });
  let totalHour = 0;
  let totalCredit = 0;
  let weeklyHours = 0;
  const particleSums = {};

  for (const block of blocks) {
    const blockSerials = serialIndex.get(block.blockCode || "") || [];
    for (const sci of block.sciences || []) {
      if (isDoubleCountedHeader(sci, blockSerials)) continue;
      totalCredit += Number(sci.totalCredit) || 0;
      weeklyHours += Number(sci.weeklyHours) || 0;

      const umumiy = (sci.particle || []).find(
        (p) =>
          p?.slug === "umumiy_yuklamaning_hajmi_soat" ||
          p?.canonical === "hour",
      );
      if (umumiy) totalHour += Number(umumiy.value) || 0;

      for (const p of sci.particle || []) {
        if (!p?.slug) continue;
        if (!particleSums[p.slug]) {
          particleSums[p.slug] = {
            slug: p.slug,
            title: p.title || "",
            value: 0,
            slugRef: p.slugRef || null,
            canonical: p.canonical || null,
            colNum: p.colNum != null ? p.colNum : null,
          };
        }
        particleSums[p.slug].value += Number(p.value) || 0;
      }
    }
  }

  const blocksTotalParticles = Object.values(particleSums);

  semesterData.blocksTotal = {
    title: "Jami",
    totalHour,
    totalCredit,
    weeklyHours,
    particles: blocksTotalParticles,
  };

  const practice = semesterData.practice || {};
  const grandParticleSums = {};
  for (const p of blocksTotalParticles) {
    grandParticleSums[p.slug] = { ...p };
  }
  for (const p of practice.particles || []) {
    if (!p?.slug) continue;
    if (!grandParticleSums[p.slug]) {
      grandParticleSums[p.slug] = {
        slug: p.slug,
        title: p.title || "",
        value: 0,
        slugRef: p.slugRef || null,
      };
    }
    grandParticleSums[p.slug].value += Number(p.value) || 0;
  }

  semesterData.grandTotal = {
    title: "Jami semestrda",
    totalHour: totalHour + (Number(practice.hour) || 0),
    totalCredit: totalCredit + (Number(practice.credit) || 0),
    weeklyHours,
    particles: Object.values(grandParticleSums),
  };
}

WorkingPlanSchema.pre("save", async function (next) {
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

    if (this.semesters) {
      for (const [, semData] of iterMap(this.semesters)) {
        if (!semData) continue;

        for (const block of semData.blocks || []) {
          for (const sci of block.sciences || []) {
            await fillItems(sci.particle);
          }
        }

        if (semData.practice?.particles) {
          await fillItems(semData.practice.particles);
        }
      }
    }

    if (this.semesters && this.isModified("semesters")) {
      const semKeys = [...this.semesters.keys()].sort(
        (a, b) => Number(a) - Number(b),
      );
      const blockSerialIndex = buildBlockSerialIndex(this.semesters);

      for (let i = 0; i < semKeys.length; i++) {
        const semKey = semKeys[i];
        const isLastSemester = i === semKeys.length - 1;
        const semData = this.semesters.get(semKey);
        if (semData) {
          if (!semData.semester) semData.semester = semKey;
          computeSemesterTotals(semData, isLastSemester, blockSerialIndex);
          this.semesters.set(semKey, semData);
        }
      }
    }

    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("workingPlan", WorkingPlanSchema);

module.exports.computeSemesterTotals = computeSemesterTotals;
