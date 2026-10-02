const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");

const WorkItemSchema = new mongoose.Schema({
  slug: { type: String, default: "" },
  title: { type: String, default: "" },
  stream: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  value: { type: Number, default: 0 },
  canonical: { type: String, default: null },
  colNum: { type: Number, default: null },
  overridden: { type: Boolean, default: false },
});

const WorkLabelSchema = new mongoose.Schema({
  slug: { type: String, default: "" },
  slugRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "educationActivityType",
    default: null,
  },
  title: { type: String, default: "" },
  canonical: { type: String, default: null },
  colNum: { type: Number, default: null },
});

const StudyWorkMetaSchema = new mongoose.Schema({
  title: { type: String, default: null },
  group: { type: String, default: null },
  stream: { type: String, default: null },
  semester: { type: String, default: null },
  thisSemester: {
    title: { type: String, default: null },
    totalHour: { type: String, default: null },
    auditoriumHour: { type: String, default: null },
  },
  classTypes: { type: [WorkLabelSchema], default: [] },
  items: { type: [WorkLabelSchema], default: [] },
});

const OtherWorkMetaSchema = new mongoose.Schema({
  title: { type: String, default: null },
  items: { type: [WorkLabelSchema], default: [] },
});

const MetaSchema = new mongoose.Schema({
  science: { type: String, default: null },
  course: { type: String, default: null },
  student: { type: String, default: null },
  studyWork: { type: StudyWorkMetaSchema, default: () => ({}) },
  otherWork: { type: OtherWorkMetaSchema, default: () => ({}) },
  leadership: { type: String, default: null },
  totalHour: { type: String, default: null },
});

const StudyWorkNumberSchema = new mongoose.Schema({
  group: { type: Number, default: 0 },
  stream: { type: Number, default: 0 },
  semester: { type: Number, default: 0 },
  isLastSemester: { type: Boolean, default: true },
  thisSemester: {
    totalHour: { type: Number, default: 0 },
    auditoriumHour: { type: Number, default: 0 },
    teachingAuditoriumHour: { type: Number, default: 0 },
    independentHour: { type: Number, default: 0 },
  },
  classTypes: { type: [WorkItemSchema], default: [] },
  items: { type: [WorkItemSchema], default: [] },
});

const OtherWorkNumberSchema = new mongoose.Schema({
  items: { type: [WorkItemSchema], default: [] },
});

const BlockSchema = new mongoose.Schema({
  section: { type: String, default: null },
  type: {
    type: String,
    enum: ["lesson", "practice", "supervision"],
    default: "lesson",
  },
  science: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "science",
    default: null,
  },
  practiceTitle: { type: String, default: null },
  course: { type: Number, default: 0 },
  courseRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "course",
    default: null,
  },
  student: { type: Number, default: 0 },
  studyWork: { type: StudyWorkNumberSchema, default: () => ({}) },
  otherWork: { type: OtherWorkNumberSchema, default: () => ({}) },
  leadership: { type: Number, default: 0 },
  totalHour: { type: Number, default: 0 },
});

const DirectionBlockSchema = new mongoose.Schema({
  direction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "direction",
    required: true,
  },
  workingPlan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "workingPlan",
    default: null,
  },
  blocks: { type: [BlockSchema], default: [] },
});

const StaffPositionItemSchema = new mongoose.Schema({
  category: { type: String, default: "" },
  slug: { type: String, default: "" },
  title: { type: String, default: "" },
  positions: { type: Number, default: 0 },
  load: { type: Number, default: 0 },
  totalHours: { type: Number, default: 0 },
  hourly: { type: Number, default: 0 },
});

const StaffPositionsSchema = new mongoose.Schema({
  items: { type: [StaffPositionItemSchema], default: [] },
  totalPositions: { type: Number, default: 0 },
  hourly: { type: Number, default: 0 },
});

const WorkloadApprovalStepSchema = new mongoose.Schema({
  step: {
    type: String,
    enum: ["methodical", "kafedra", "financial", "prorektor", "rektor"],
    required: true,
  },
  label: { type: String, default: null },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    default: null,
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  comment: { type: String, default: null },
  signature: { type: String, default: null },
  eriSignature: { type: String, default: null },
  eriSerial: { type: String, default: null },
  eriSignedAt: { type: Date, default: null },
  date: { type: Date, default: null },
});

const {
  VerifySnapshotSchema: WorkloadVerifySnapshotSchema,
} = require("#modules/4.02-studyLoad/_shared/verifySnapshotSchema");

const WorkloadSchema = new mongoose.Schema(
  {
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "department",
      default: null,
    },
    title: {
      type: String,
      default:
        "____________________ kafedrasining 202__/202__ o‘quv yili uchun soatlar hisobi va ish o'rinlari",
    },
    agreed: {
      agree: { type: String, default: null },
      position: { type: String, default: null },
      viceRector: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default: null,
      },
      signature: { type: String, default: null },
      date: { type: String, default: null },
    },
    confirmation: {
      confirm: { type: String, default: null },
      position: { type: String, default: null },
      rector: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default: null,
      },
      signature: { type: String, default: null },
      date: { type: String, default: null },
    },
    academicYear: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "academicYear",
      required: true,
    },

    meta: { type: MetaSchema, default: () => ({}) },
    directions: { type: [DirectionBlockSchema], default: [] },
    staffPositions: { type: StaffPositionsSchema, default: () => ({}) },

    methodicalHead: {
      position: { type: String, default: null },
      leader: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default: null,
      },
      signature: { type: String, default: null },
      date: { type: String, default: null },
    },
    financialHead: {
      position: { type: String, default: null },
      leader: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default: null,
      },
      signature: { type: String, default: null },
      date: { type: String, default: null },
    },

    approvalSteps: {
      type: [WorkloadApprovalStepSchema],
      default: () => [
        { step: "methodical" },
        { step: "kafedra" },
        { step: "financial" },
        { step: "prorektor" },
        { step: "rektor" },
      ],
    },

    status: {
      type: String,
      enum: ["draft", "new", "in_review", "approved", "rejected", "superseded"],
      default: "draft",
    },

    version: { type: Number, default: 1 },
    previousVersion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "workload",
      default: null,
    },
    supersededBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "workload",
      default: null,
    },
    supersededAt: { type: Date, default: null },

    file: { type: String, default: null },
    date: { type: String, required: true },
    active: { type: Boolean, default: true },
    comment: { type: String, default: null },

    needsRecalculation: { type: Boolean, default: false },
    lastRecalculation: {
      triggeredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default: null,
      },
      triggeredAt: { type: Date, default: null },
      reason: { type: String, default: null },
    },

    lastEditedAfterApprovalAt: { type: Date, default: null },
    lastEditedAfterApprovalBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },

    verify: {
      token: { type: String },
      issuedAt: { type: Date, default: null },
      issuedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default: null,
      },
      revokedAt: { type: Date, default: null },
      revokedReason: { type: String, default: null },
      snapshot: { type: [WorkloadVerifySnapshotSchema], default: [] },
    },
  },
  { timestamps: true, versionKey: false },
);

const STREAM_BASED_CLASS_TYPE_KEYS = new Set([
  "lecture",
  "maruza",
]);

const ON_HOURS_PER_STUDENT = 0.2;
const YAN_HOURS_PER_STUDENT = 0.3;
const YAN_DIVISOR = 2;
const MISSED_HOURS_PER_STUDENT = 0.1;
const AUTO_CALCULATED_ITEM_SLUGS = Object.freeze({
  on: ON_HOURS_PER_STUDENT,
  yan: YAN_HOURS_PER_STUDENT / YAN_DIVISOR,
  qoldirilgan: MISSED_HOURS_PER_STUDENT,
});

const ON_MIN_AUDITORIUM_HOURS = 71.99;

const CLINICAL_PRACTICE_SHARE = 0.5;

function calcPerGroup(student, group) {
  const s = Number(student) || 0;
  const g = Number(group) || 0;
  return g > 0 && s > 0 ? Math.round(s / g) : 0;
}

function calculateBlockTotal(sw, ow, leadership = 0, student = 0) {
  sw.thisSemester = sw.thisSemester || {};

  const classTypes = Array.isArray(sw.classTypes) ? sw.classTypes : [];
  const streamCount = Number(sw.stream) || 0;
  const groupCount = Number(sw.group) || 0;

  let planAuditorium = 0;
  let teachingHour = 0;
  classTypes.forEach((ct) => {
    const key = ct.canonical || ct.slug;
    const multiplier = STREAM_BASED_CLASS_TYPE_KEYS.has(key)
      ? streamCount
      : groupCount;
    const stream = Number(ct.stream) || 0;
    ct.total = stream * multiplier;
    planAuditorium += stream;
    teachingHour += ct.total;
  });

  const items = Array.isArray(sw.items) ? sw.items : [];
  const studentCount = Number(student) || 0;
  const isLastSemester = sw.isLastSemester !== false;
  function isEligible(slug) {
    switch (slug) {
      case "on":
        return planAuditorium > ON_MIN_AUDITORIUM_HOURS;
      case "yan":
        return isLastSemester;
      case "qoldirilgan":
        return true;
      default:
        return true;
    }
  }
  items.forEach((it) => {
    if (it.overridden) return;
    const coefficient = AUTO_CALCULATED_ITEM_SLUGS[it.slug];
    if (coefficient === undefined) return;
    it.value = isEligible(it.slug)
      ? Math.round(studentCount * coefficient)
      : 0;
  });
  const itemsSum = items.reduce((acc, it) => acc + (Number(it.value) || 0), 0);

  const independentHour = Number(sw.thisSemester.independentHour) || 0;
  sw.thisSemester.auditoriumHour = planAuditorium;
  sw.thisSemester.teachingAuditoriumHour = teachingHour;
  sw.thisSemester.totalHour = planAuditorium + independentHour;

  const owItems = ow && Array.isArray(ow.items) ? ow.items : [];
  const owSum = owItems.reduce((acc, it) => acc + (Number(it.value) || 0), 0);

  return teachingHour + itemsSum + owSum + (Number(leadership) || 0);
}

WorkloadSchema.index({ department: 1, academicYear: 1 });
WorkloadSchema.index({ "directions.workingPlan": 1 });
WorkloadSchema.index({ "directions.direction": 1 });
WorkloadSchema.index(
  { "verify.token": 1 },
  {
    unique: true,
    partialFilterExpression: { "verify.token": { $type: "string" } },
  },
);
WorkloadSchema.index(
  { department: 1, academicYear: 1, version: 1 },
  {
    unique: true,
    name: "uniq_version_per_department_year",
    partialFilterExpression: { version: { $gte: 2 }, active: true },
  },
);

WorkloadSchema.plugin(mongoosePaginate);
WorkloadSchema.plugin(aggregatePaginate);

WorkloadSchema.pre("save", async function (next) {
  try {
    const { resolveCourse } = require("#references/_services/courseResolver");
    const {
      resolveOrCreate: resolveActivityType,
    } = require("#references/_services/educationActivityResolver");

    for (const dir of this.directions || []) {
      for (const block of dir.blocks || []) {
        if (block.course && !block.courseRef) {
          block.courseRef = await resolveCourse(block.course);
        }
      }
    }

    const labelArrays = [
      this.meta?.studyWork?.classTypes,
      this.meta?.studyWork?.items,
      this.meta?.otherWork?.items,
    ];
    for (const arr of labelArrays) {
      if (!Array.isArray(arr)) continue;
      for (const item of arr) {
        if (item.title && !item.slugRef) {
          item.slugRef = await resolveActivityType(item.title);
        }
      }
    }

    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("workload", WorkloadSchema);
module.exports.calculateBlockTotal = calculateBlockTotal;
module.exports.ON_HOURS_PER_STUDENT = ON_HOURS_PER_STUDENT;
module.exports.YAN_HOURS_PER_STUDENT = YAN_HOURS_PER_STUDENT;
module.exports.YAN_DIVISOR = YAN_DIVISOR;
module.exports.MISSED_HOURS_PER_STUDENT = MISSED_HOURS_PER_STUDENT;
module.exports.ON_MIN_AUDITORIUM_HOURS = ON_MIN_AUDITORIUM_HOURS;
module.exports.CLINICAL_PRACTICE_SHARE = CLINICAL_PRACTICE_SHARE;
module.exports.AUTO_CALCULATED_ITEM_SLUGS = AUTO_CALCULATED_ITEM_SLUGS;
module.exports.calcPerGroup = calcPerGroup;
