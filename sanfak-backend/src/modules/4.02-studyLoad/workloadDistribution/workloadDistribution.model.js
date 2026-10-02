const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const aggregatePaginate = require("mongoose-aggregate-paginate-v2");
const {
  VerifySnapshotSchema,
} = require("#modules/4.02-studyLoad/_shared/verifySnapshotSchema");

const ACCEPTANCE_STATUSES = ["pending", "accepted", "rejected"];

const ASSIGNMENT_BASES = [
  "kafedrada_mutaxassis_yoq",
  "ish_tajribasi",
  "oqigan_fani_yaqin",
  "sertifikat_malaka",
  "ilmiy_ishlar",
  "boshqa",
];

const WorkItemSchema = new mongoose.Schema({
  slug: { type: String, default: "" },
  title: { type: String, default: "" },
  stream: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  value: { type: Number, default: 0 },
});

const WorkLabelSchema = new mongoose.Schema({
  slug: { type: String, default: "" },
  slugRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "educationActivityType",
    default: null,
  },
  title: { type: String, default: "" },
});

const StudyWorkNumberSchema = new mongoose.Schema({
  group: { type: Number, default: 0 },
  stream: { type: Number, default: 0 },
  semester: { type: Number, default: 0 },
  thisSemester: {
    totalHour: { type: Number, default: 0 },
    auditoriumHour: { type: Number, default: 0 },
    teachingAuditoriumHour: { type: Number, default: 0 },
  },
  classTypes: { type: [WorkItemSchema], default: [] },
  items: { type: [WorkItemSchema], default: [] },
});

const StreamSchema = new mongoose.Schema(
  {
    number: { type: Number, required: true },
    groups: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "group",
      },
    ],
    studentCount: { type: Number, default: 0 },
    language: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "languageOfInstruction",
      default: null,
    },
  },
  { _id: true },
);

const AssignmentBlockSchema = new mongoose.Schema({
  workloadBlockId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
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
  electiveSlot: {
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
  semester: { type: Number, enum: [1, 2], default: 1 },
  student: { type: Number, default: 0 },
  subGroup: { type: Number, default: 0 },
  groups: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "group",
    },
  ],
  streams: { type: [StreamSchema], default: [] },
  studyWork: { type: StudyWorkNumberSchema, default: () => ({}) },
  nonAuditHour: { type: Number, default: 0 },
  totalHour: { type: Number, default: 0 },
  classTypeSlugs: { type: [String], default: [] },

  acceptanceStatus: { type: String, enum: ACCEPTANCE_STATUSES, default: "pending" },
  rejectionReason: { type: String, default: null },
  respondedAt: { type: Date, default: null },

  suitability: {
    flag: {
      type: String,
      enum: ["match", "crossDepartment", "unknown"],
      default: "unknown",
    },
    teacherDepartment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "department",
      default: null,
    },
    scienceDepartment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "department",
      default: null,
    },
    computedAt: { type: Date, default: null },
  },

  justification: {
    basis: {
      type: String,
      enum: [...ASSIGNMENT_BASES, null],
      default: null,
    },
    note: { type: String, default: null },
    declaredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },
    declaredAt: { type: Date, default: null },
  },
});

const TeacherAssignmentSchema = new mongoose.Schema({
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    default: null,
  },
  isVacant: { type: Boolean, default: false },
  vacantLabel: { type: String, default: null },
  vacantSince: { type: Date, default: null },
  vacancyReason: { type: String, default: null },

  vacancyNumber: { type: Number, default: null },

  assignedAt: { type: Date, default: null },

  vacancy: {
    requiredPosition: { type: String, default: null },
    requiredSpecialization: { type: String, default: null },
    requiredAcademicTitle: { type: String, default: null },
    deadline: { type: Date, default: null },
    postedAt: { type: Date, default: null },
    history: [
      {
        teacher: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "user",
          default: null,
        },
        assignedAt: { type: Date, default: null },
        leftAt: { type: Date, default: null },
        reason: { type: String, default: null },
      },
    ],
  },

  reassignedAt: { type: Date, default: null },
  reassignedFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    default: null,
  },
  reassignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    default: null,
  },

  stavka: {
    type: Number,
    min: 0,
    max: 2,
    default: 1.0,
  },
  position: { type: String, default: null },
  specialization: { type: String, default: null },
  phone: { type: String, default: null },

  blocks: { type: [AssignmentBlockSchema], default: [] },
  totalHour: { type: Number, default: 0 },

  acceptanceStatus: {
    type: String,
    enum: ACCEPTANCE_STATUSES,
    default: "pending",
  },
  rejectionReason: { type: String, default: null },
  respondedAt: { type: Date, default: null },
});

const StaffPositionItemSchema = new mongoose.Schema({
  category: { type: String, default: "" },
  slug: { type: String, default: "" },
  title: { type: String, default: "" },
  positions: { type: Number, default: 0 },
  load: { type: Number, default: 0 },
  totalHours: { type: Number, default: 0 },
});

const StaffPositionsSchema = new mongoose.Schema({
  items: { type: [StaffPositionItemSchema], default: [] },
  totalPositions: { type: Number, default: 0 },
  hourly: { type: Number, default: 0 },
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

const MetaDistributionSchema = new mongoose.Schema({
  science: { type: String, default: null },
  course: { type: String, default: null },
  student: { type: String, default: null },
  subGroup: { type: String, default: null },
  studyWork: { type: StudyWorkMetaSchema, default: () => ({}) },
  totalHour: { type: String, default: null },
});

const DistApprovalStepSchema = new mongoose.Schema({
  step: {
    type: String,
    enum: ["kafedra", "methodical", "financial", "dean", "prorektor"],
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

const WorkloadDistributionSchema = new mongoose.Schema(
  {
    workload: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "workload",
      required: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "department",
      default: null,
    },

    course: { type: Number, default: 0 },
    courseRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "course",
      default: null,
    },
    scienceNumber: { type: Number, default: 0 },
    totalHour: { type: Number, default: 0 },
    residueHour: { type: Number, default: 0 },

    title: { type: String, default: null },

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

    meta: { type: MetaDistributionSchema, default: () => ({}) },
    teachers: { type: [TeacherAssignmentSchema], default: [] },
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
    departmentHead: {
      position: { type: String, default: null },
      manager: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default: null,
      },
      signature: { type: String, default: null },
      date: { type: String, default: null },
    },

    approvalSteps: {
      type: [DistApprovalStepSchema],
      default: () => [
        { step: "kafedra" },
        { step: "methodical" },
        { step: "financial" },
        { step: "dean" },
        { step: "prorektor" },
      ],
    },

    status: {
      type: String,
      enum: ["draft", "new", "in_review", "approved", "rejected", "superseded"],
      default: "draft",
    },
    supersededBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "workloadDistribution",
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
      snapshot: { type: [VerifySnapshotSchema], default: [] },
    },
  },
  { timestamps: true, versionKey: false },
);

WorkloadDistributionSchema.index({ workload: 1 });
WorkloadDistributionSchema.index({ department: 1, academicYear: 1 });
WorkloadDistributionSchema.index({ "teachers.teacher": 1 });
WorkloadDistributionSchema.index(
  { "verify.token": 1 },
  {
    unique: true,
    partialFilterExpression: { "verify.token": { $type: "string" } },
  },
);

WorkloadDistributionSchema.plugin(mongoosePaginate);
WorkloadDistributionSchema.plugin(aggregatePaginate);

WorkloadDistributionSchema.pre("save", async function (next) {
  try {
    const { resolveCourse } = require("#references/_services/courseResolver");
    const {
      resolveOrCreate: resolveActivityType,
    } = require("#references/_services/educationActivityResolver");

    if (this.course && !this.courseRef) {
      this.courseRef = await resolveCourse(this.course);
    }

    for (const entry of this.teachers || []) {
      for (const block of entry.blocks || []) {
        if (block.course && !block.courseRef) {
          block.courseRef = await resolveCourse(block.course);
        }
      }
    }

    const labelArrays = [
      this.meta?.studyWork?.classTypes,
      this.meta?.studyWork?.items,
    ];
    for (const arr of labelArrays) {
      if (!Array.isArray(arr)) continue;
      for (const item of arr) {
        if (item.title && !item.slugRef) {
          item.slugRef = await resolveActivityType(item.title);
        }
      }
    }

    const allGroupIds = new Set();
    for (const entry of this.teachers || []) {
      for (const block of entry.blocks || []) {
        for (const stream of block.streams || []) {
          for (const gid of stream.groups || []) {
            if (gid) allGroupIds.add(String(gid));
          }
        }
      }
    }

    if (allGroupIds.size > 0) {
      const GroupModel = require("#references/group/group.model");
      const groups = await GroupModel.find(
        { _id: { $in: Array.from(allGroupIds) } },
        { studentNumber: 1, lang: 1 },
      ).lean();
      const groupMap = new Map(groups.map((g) => [String(g._id), g]));

      for (const entry of this.teachers || []) {
        for (const block of entry.blocks || []) {
          for (const stream of block.streams || []) {
            const ids = (stream.groups || []).map(String);
            stream.studentCount = ids.reduce((sum, gid) => {
              const g = groupMap.get(gid);
              return sum + (g?.studentNumber || 0);
            }, 0);
            if (!stream.language && ids.length) {
              const firstLang = groupMap.get(ids[0])?.lang;
              if (firstLang) stream.language = firstLang;
            }
          }
        }
      }
    }

    {
      const used = new Set();
      for (const t of this.teachers || []) {
        if (
          t.isVacant &&
          Number.isInteger(t.vacancyNumber) &&
          t.vacancyNumber > 0
        ) {
          used.add(t.vacancyNumber);
        }
      }
      let nextNumber = 1;
      const allocate = () => {
        while (used.has(nextNumber)) nextNumber++;
        used.add(nextNumber);
        return nextNumber;
      };
      for (const t of this.teachers || []) {
        if (t.isVacant) {
          if (!Number.isInteger(t.vacancyNumber) || t.vacancyNumber <= 0) {
            t.vacancyNumber = allocate();
          }
          if (!t.vacancy) t.vacancy = {};
          if (!t.vacancy.postedAt) t.vacancy.postedAt = new Date();
        } else {
          t.vacancyNumber = null;
        }
      }
    }

    for (const t of this.teachers || []) {
      if (t.teacher && !t.isVacant && !t.assignedAt) {
        t.assignedAt = new Date();
      }
    }

    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model(
  "workloadDistribution",
  WorkloadDistributionSchema,
);
module.exports.ACCEPTANCE_STATUSES = ACCEPTANCE_STATUSES;
module.exports.ASSIGNMENT_BASES = ASSIGNMENT_BASES;
