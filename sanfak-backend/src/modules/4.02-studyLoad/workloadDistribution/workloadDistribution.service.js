"use strict";

const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");
const {
  isElectiveBlock,
  isElectiveSlotRow,
} = require("#modules/4.02-studyLoad/_shared/electiveBlock");
const {
  isEditable,
  notEditableMessage,
  EDITABLE_STATUSES,
} = require("#modules/4.02-studyLoad/_shared/editableStatus");
const Workload = require("#modules/4.02-studyLoad/workload/workload.model");
const WorkingPlan = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const WorkloadDistribution = require("./workloadDistribution.model");
const suitabilityFlag = require("#modules/4.02-studyLoad/_services/suitabilityFlag");
const TeacherProfile = require("#modules/4.03-teacher/teacher/teacher.model");

const sameId = (a, b) => Boolean(a) && Boolean(b) && String(a) === String(b);

const findAssignmentBlock = (dist, blockId) => {
  for (const entry of dist.teachers || []) {
    for (const block of entry.blocks || []) {
      if (sameId(block._id, blockId)) return { entry, block };
    }
  }
  return { entry: null, block: null };
};

const getSemesterData = (plan, semKey) =>
  plan?.semesters instanceof Map
    ? plan.semesters.get(String(semKey))
    : plan?.semesters?.[String(semKey)];

const locateSlotInPlan = async ({
  workingPlanId,
  semester,
  section,
  science,
}) => {
  if (!workingPlanId || !science) return null;

  const plan = await WorkingPlan.findById(workingPlanId, {
    semesters: 1,
  }).lean();
  const semData = getSemesterData(plan, semester || 1);
  const blocks = semData?.blocks || [];
  if (blocks.length === 0) return null;

  const hinted = [];
  const rest = [];
  for (const planBlock of blocks) {
    const label = planBlock.title || planBlock.blockCode || null;
    (section && sameId(label, section) ? hinted : rest).push(planBlock);
  }

  for (const planBlock of [...hinted, ...rest]) {
    const row = (planBlock.sciences || []).find((s) =>
      sameId(s.science, science),
    );
    if (row) return { planBlock, row };
  }
  return null;
};

const locatePlanSlot = async (dist, block) => {
  if (!block || !block.workloadBlockId) return null;

  const workload = await Workload.findById(dist.workload, {
    directions: 1,
  }).lean();
  if (!workload) return null;

  let workingPlanId = null;
  for (const dir of workload.directions || []) {
    const hit = (dir.blocks || []).some((b) =>
      sameId(b._id, block.workloadBlockId),
    );
    if (hit) {
      workingPlanId = dir.workingPlan;
      break;
    }
  }

  return locateSlotInPlan({
    workingPlanId,
    semester: block.semester,
    section: block.section,
    science: block.electiveSlot || block.science,
  });
};

const notSelectableReason = (distDepartment, scienceDepartment) => {
  if (!distDepartment) {
    return "Taqsimotning kafedrasi aniqlanmagan — fan tanlab bo'lmaydi";
  }
  if (!scienceDepartment) {
    return "Fanning kafedrasi ko'rsatilmagan — fan tanlab bo'lmaydi";
  }
  if (!sameId(distDepartment, scienceDepartment)) {
    return "Boshqa kafedra fani — hozircha faqat o'z kafedrangiz fanini tanlash mumkin";
  }
  return null;
};

const toOption = (src) => ({
  science: src.science ? String(src.science) : null,
  code: src.code || null,
  title: src.title || null,
  department: src.department ? String(src.department) : null,
});

const emptyOptions = () => ({ main: null, alternatives: [] });

const resolveElectiveSlot = async ({
  workingPlanId,
  semester,
  section,
  science,
}) => {
  if (!workingPlanId || !science) return null;
  try {
    const located = await locateSlotInPlan({
      workingPlanId,
      semester,
      section,
      science,
    });
    if (!located || !isElectiveSlotRow(located.planBlock, located.row)) {
      return null;
    }
    return science;
  } catch (err) {
    winston.error(
      `[workloadDistribution] electiveSlot aniqlanmadi (workingPlan=${workingPlanId} semester=${semester}): ${err.message}`,
    );
    return null;
  }
};

const getElectiveOptions = async ({ id, blockId, scope = {} }) => {
  const dist = await WorkloadDistribution.findOne(
    { _id: id, ...scope },
    { workload: 1, department: 1, status: 1, teachers: 1 },
  ).lean();
  if (!dist) throw new ErrorHandler(404, "Taqsimot topilmadi");

  const { entry, block } = findAssignmentBlock(dist, blockId);
  if (!block) throw new ErrorHandler(404, "Blok topilmadi");

  const located = await locatePlanSlot(dist, block);
  if (!located || !isElectiveSlotRow(located.planBlock, located.row)) {
    return emptyOptions();
  }

  let teacherDepartmentId = null;
  if (entry?.teacher) {
    try {
      const profile = await TeacherProfile.findOne({ user: entry.teacher })
        .select("department")
        .lean();
      teacherDepartmentId = profile?.department || null;
    } catch (err) {
      winston.error(
        `[workloadDistribution] getElectiveOptions — o'qituvchi kafedrasi aniqlanmadi (teacher=${entry.teacher}): ${err.message}`,
      );
    }
  }
  const withSuitability = (option) => ({
    ...option,
    suitability: suitabilityFlag.evaluateSuitability({
      teacherDepartmentId,
      scienceDepartmentId: option.department,
    }),
  });

  const { row } = located;
  const decorate = (src) => {
    const option = toOption(src);
    const reason = notSelectableReason(dist.department, src.department);
    return withSuitability({ ...option, selectable: reason === null, reason });
  };

  return {
    main: withSuitability(toOption(row)),
    alternatives: (row.alternatives || []).map(decorate),
  };
};

const applyElectiveChoice = async ({
  id,
  blockId,
  scienceId,
  scope = {},
  user,
  suitabilityBasis,
  suitabilityNote,
}) => {
  const dist = await WorkloadDistribution.findOne(
    { _id: id, ...scope },
    { workload: 1, department: 1, status: 1, teachers: 1 },
  ).lean();
  if (!dist) throw new ErrorHandler(404, "Taqsimot topilmadi");

  if (!isEditable(dist.status)) {
    throw new ErrorHandler(400, notEditableMessage("taqsimot", dist.status));
  }

  const { entry, block } = findAssignmentBlock(dist, blockId);
  if (!block) throw new ErrorHandler(404, "Blok topilmadi");

  const located = await locatePlanSlot(dist, block);
  if (!located) {
    throw new ErrorHandler(
      400,
      "Bu blok uchun ishchi o'quv rejadagi tanlov sloti topilmadi — fan almashtirib bo'lmaydi",
      `workloadBlockId=${block.workloadBlockId || "null"} semester=${block.semester}`,
    );
  }
  if (!isElectiveSlotRow(located.planBlock, located.row)) {
    throw new ErrorHandler(
      400,
      "Bu blok tanlov blokidan kelmagan — majburiy fanni almashtirib bo'lmaydi",
    );
  }

  const { row } = located;
  const options = [row, ...(row.alternatives || [])];
  const chosen = options.find((o) => sameId(o.science, scienceId));
  if (!chosen) {
    throw new ErrorHandler(
      400,
      "Tanlangan fan bu slotning variantlari ro'yxatida yo'q",
      `scienceId=${scienceId}`,
    );
  }

  const reason = notSelectableReason(dist.department, chosen.department);
  if (reason) {
    throw new ErrorHandler(
      400,
      `Bu fanni tanlab bo'lmaydi. ${reason}`,
      `distDepartment=${dist.department || "null"} scienceDepartment=${chosen.department || "null"}`,
    );
  }

  const electiveSlot = block.electiveSlot || block.science;

  const suitability = await suitabilityFlag.buildSuitability({
    teacherUserId: entry.teacher,
    scienceId: chosen.science,
  });

  let justification = suitabilityFlag.emptyJustification();
  if (suitabilityFlag.requiresJustification(suitability.flag)) {
    if (!suitabilityBasis) {
      throw new ErrorHandler(
        409,
        "Boshqa kafedra o'qituvchisiga fan biriktirilmoqda — sabab (bayonnoma) ko'rsatilishi shart",
        `teacherDepartment=${suitability.teacherDepartment || "null"} scienceDepartment=${suitability.scienceDepartment || "null"}`,
        {
          code: "SUITABILITY_BASIS_REQUIRED",
          suitability: "crossDepartment",
          blockIds: [String(block._id)],
        },
      );
    }
    justification = {
      basis: suitabilityBasis,
      note: suitabilityNote,
      declaredBy: user?._id || null,
      declaredAt: new Date(),
    };
  }

  const result = await WorkloadDistribution.updateOne(
    { _id: id, ...scope, status: { $in: EDITABLE_STATUSES } },
    {
      $set: {
        "teachers.$[t].blocks.$[b].science": chosen.science,
        "teachers.$[t].blocks.$[b].electiveSlot": electiveSlot,
        "teachers.$[t].blocks.$[b].suitability": suitability,
        "teachers.$[t].blocks.$[b].justification": justification,
      },
    },
    { arrayFilters: [{ "t._id": entry._id }, { "b._id": block._id }] },
  );

  if (!result || result.matchedCount === 0) {
    throw new ErrorHandler(
      409,
      "Taqsimot holati o'zgardi — tanlov saqlanmadi. Sahifani yangilab qayta urinib ko'ring",
    );
  }

  return {
    distribution: String(id),
    blockId: String(block._id),
    science: String(chosen.science),
    electiveSlot: String(electiveSlot),
    totalHour: block.totalHour || 0,
  };
};

module.exports = {
  getElectiveOptions,
  applyElectiveChoice,
  resolveElectiveSlot,
};
