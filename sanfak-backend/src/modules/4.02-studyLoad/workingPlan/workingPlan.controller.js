const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");
const WorkingPlanModel = require("./workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
const ScienceModel = require("#references/science/science.model");
const { translaterLanguage } = require("#shared/translate");
const { default: mongoose } = require("mongoose");
const {
  generateWorkingPlanPdf,
} = require("#modules/4.02-studyLoad/_pdf/workingPlan.pdf");
const { particleValue, CANONICAL } = require("#shared/particleHelpers");
const { semesterDisplayNo } = require("#modules/4.02-studyLoad/_shared/semesterKey");
const { isEmptySlotRow } = require("#modules/4.02-studyLoad/_shared/electiveSlotRow");
const { isElectiveBlock } = require("#modules/4.02-studyLoad/_shared/electiveBlock");
const { EMPTY_SLOT_TITLE } = require("#modules/4.02-studyLoad/_shared/planRowType");
const { parseReja, fileUrlToPath } = require("#shared/pythonParser");
const {
  narrowParentFilter,
} = require("#modules/4.02-studyLoad/_shared/parentDirectionScope");
const {
  isLocked,
  lockedMessage,
} = require("#modules/4.02-studyLoad/_shared/editableStatus");
const {
  enrichMetaWithSlugRefs,
  populateAllSlugRefs,
} = require("#references/_services/educationActivityResolver");
const {
  buildSemesterTable,
  buildBlocksTable,
  buildSemestersBlocksTable,
} = require("#modules/4.02-studyLoad/_services/semesterBreakdown");
const {
  buildBlockSerialIndex,
  isDoubleCountedHeader,
} = require("#modules/4.02-studyLoad/_shared/planRowType");
const {
  isAggregateRow,
} = require("#modules/4.02-studyLoad/_shared/aggregateRow");

const service = require("./workingPlan.service");

const hasOwnTitle = (obj) =>
  obj != null && Object.prototype.hasOwnProperty.call(obj, "title");

const rowTypeOfPlanRow = (sci, blockSerials, block) => {
  if (isEmptySlotRow(sci) && isElectiveBlock(block)) return "electiveSlot";
  if (isAggregateRow(sci)) return "aggregate";
  return isDoubleCountedHeader(sci, blockSerials) ? "sectionHeader" : "subject";
};

const annotateRowTypes = (doc) => {
  const serialIndex = buildBlockSerialIndex(doc.semesters);
  const unfilled = [];
  for (const semKey of Object.keys(doc.semesters || {})) {
    for (const block of doc.semesters[semKey]?.blocks || []) {
      const blockSerials = serialIndex.get(block.blockCode || "") || [];
      for (const sci of block.sciences || []) {
        sci.rowType = rowTypeOfPlanRow(sci, blockSerials, block);
        if (sci.rowType !== "electiveSlot") continue;
        unfilled.push({
          semKey,
          blockId: String(block._id),
          rowId: String(sci._id),
          serialNumber: sci.serialNumber || null,
          credit: Number(sci.totalCredit) || 0,
          hour: Number(sci.weeklyHours) || 0,
        });
      }
    }
  }
  return unfilled;
};

const wrapErr = (err, message) => {
  if (err.statusCode) return err;
  winston.error(`[workingPlan] ${message}: ${err.message}`);
  return new ErrorHandler(500, message);
};

module.exports = {
  subAddWorkingPlan: async (data) => {
    if (!data.file) throw new Error("planFile yuklanmadi");
    if (!data.learningProcess) throw new Error("learningProcess ID majburiy");

    const diskYoli = fileUrlToPath(data.file);
    const parsed = await parseReja(diskYoli, data.sheet || null);

    for (const block of parsed.blocks) {
      for (const element of block.sciences) {
        const fan = await ScienceModel.findOne({
          scienceCode: element.code,
        }).exec();

        element.science = fan?._id ?? null;
        element.department = fan?.department ?? null;
      }
    }

    const enrichedMeta = await enrichMetaWithSlugRefs(parsed.meta);

    return await StudyPlanModel.create({
      learningProcess: data.learningProcess,
      meta: enrichedMeta,
      blocks: parsed.blocks,
      file: data.file,
    });
  },

  addWorkingPlan: async (req, res, next) => {
    try {
      const body = { ...req.body };
      if (body.meta) {
        body.meta = await enrichMetaWithSlugRefs(body.meta);
      }

      const doc = await new WorkingPlanModel(body).save();
      if (!doc) return res.status(404).json({ message: "Failed to save" });
      return res.status(201).json({ message: "successfully created" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to add working plan", err.message),
      );
    }
  },

  findOneWorkingPlan: async (req, res, next) => {
    try {
      let doc = await WorkingScheduleModel.findOne({
        _id: req.params.id,
        ...req.scope,
      })
        .exec();
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find working plan", err.message),
      );
    }
  },

  updateWorkingPlan: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { courseId, weeks, total, statistics } = req.body;

      const inScope = await WorkingScheduleModel.exists({
        _id: id,
        ...req.scope,
      });
      if (!inScope) return next(new ErrorHandler(404, "Topilmadi"));

      const setObj = {};

      if (total !== undefined) {
        setObj["courses.$[course].total"] = total;
      }

      if (weeks) {
        setObj["courses.$[course].weeks"] = weeks;
      }

      let doc = await WorkingScheduleModel.findByIdAndUpdate(
        id,
        { $set: setObj },
        {
          arrayFilters: [
            { "course._id": new mongoose.Types.ObjectId(courseId) },
          ],
          new: true,
        },
      );

      if (!doc) return next(new ErrorHandler(404, "Topilmadi"));

      if (weeks) {
        for (const [weekNum, keyValue] of Object.entries(weeks)) {
          await WorkingScheduleModel.findByIdAndUpdate(
            id,
            {
              $set: {
                "courses.$[course].months.$[].weeks.$[week].key":
                  keyValue || " ",
              },
            },
            {
              arrayFilters: [
                { "course._id": new mongoose.Types.ObjectId(courseId) },
                { "week.week": Number(weekNum) },
              ],
            },
          );
        }
      }

      if (statistics && statistics.length > 0) {
        for (const stat of statistics) {
          await WorkingScheduleModel.findByIdAndUpdate(
            id,
            {
              $set: {
                "courses.$[course].statistics.$[stat].value": stat.value,
              },
            },
            {
              arrayFilters: [
                { "course._id": new mongoose.Types.ObjectId(courseId) },
                { "stat._id": new mongoose.Types.ObjectId(stat._id) },
              ],
            },
          );
        }

        const currentDoc = await WorkingScheduleModel.findById(id);

        const targetCourse = currentDoc.courses.find(
          (c) => c._id.toString() === courseId,
        );

        const courseStats = targetCourse?.statistics || [];
        const learningKeys = currentDoc.learningProcessData.keys.map((k) =>
          k.toObject(),
        );

        const updatedKeys = learningKeys.map((keyItem) => {
          if (keyItem.title === "JAMI") {
            const hammasiStat = currentDoc.allValues?.statistics?.find(
              (stat) => stat.slug === "hammasi",
            );
            return hammasiStat
              ? { ...keyItem, week: hammasiStat.value }
              : keyItem;
          }

          const matched = courseStats.find(
            (stat) => stat.title === keyItem.title,
          );

          return matched ? { ...keyItem, week: matched.value } : keyItem;
        });

        await WorkingScheduleModel.findByIdAndUpdate(
          id,
          { $set: { "learningProcessData.keys": updatedKeys } },
          { new: true },
        );
      }
      const updatedDoc = await WorkingScheduleModel.findById(id);
      return res.status(200).json(updatedDoc);
    } catch (err) {
      return next(new ErrorHandler(400, "Yangilashda xatolik", err.message));
    }
  },

  deleteWorkingPlan: async (req, res, next) => {
    try {
      const doc = await WorkingPlanModel.findOneAndDelete({
        _id: req.params.id,
        ...req.scope,
      });
      if (!doc) return res.status(404).json({ message: "not found" });
      return res
        .status(200)
        .json({ message: `successfully deleted ${doc?._id}` });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to delete working plan", err.message),
      );
    }
  },

  findAllWorkingPlansSchedule: async (req, res, next) => {
    try {
      const { workingSchedule } = req.query;
      if (!workingSchedule) {
        return res.status(400).json({ message: "workingSchedule not found" });
      }
      let data = { ...narrowParentFilter(req.scope, "workingSchedule", workingSchedule) };

      const doc = await WorkingPlanModel.findOne(data)
        .select(
          "meta.serialNumber meta.code meta.title meta.particles meta.distribution.semester meta.credit.semester meta.totalCredit meta.weeklyHours meta.evaluationType semesters",
        )
        .lean()
        .exec();

      if (!doc) return res.status(404).json({ message: "not found" });

      const parentWs = await WorkingScheduleModel.findById(workingSchedule)
        .select("currentCourse")
        .lean();
      doc.semesterNumbers = Object.fromEntries(
        Object.keys(doc.semesters || {}).map((semKey) => [
          semKey,
          semesterDisplayNo(semKey, parentWs?.currentCourse),
        ]),
      );

      doc.unfilledSlots = annotateRowTypes(doc);

      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find working plans", err.message),
      );
    }
  },

  updateStudyPlanScince: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { semKey, parentId, _id, particle, smester, ...updatedFields } =
        req.body;
      if (!semKey) {
        return res
          .status(400)
          .json({ message: "semKey majburiy ('1' yoki '2')" });
      }
      if (!parentId || !_id) {
        return res
          .status(400)
          .json({ message: "parentId (blok) va _id (fan) majburiy" });
      }

      const planOwner = await WorkingPlanModel.findOne(
        { _id: id, ...req.scope },
        { workingSchedule: 1 },
      ).lean();
      if (!planOwner) return res.status(404).json({ message: "not found" });

      if (planOwner.workingSchedule) {
        const parent = await WorkingScheduleModel.findById(
          planOwner.workingSchedule,
        )
          .select("status")
          .lean();
        if (parent && isLocked(parent.status)) {
          return next(
            new ErrorHandler(
              400,
              lockedMessage("Ishchi o'quv reja", parent.status),
            ),
          );
        }
      }

      const plan = await WorkingPlanModel.findOne({ _id: id, ...req.scope });
      if (!plan) return res.status(404).json({ message: "not found" });

      const semData = plan.semesters?.get(String(semKey));
      const block = (semData?.blocks || []).find(
        (b) => String(b._id) === String(parentId),
      );
      const science = (block?.sciences || []).find(
        (sc) => String(sc._id) === String(_id),
      );
      if (!science) {
        return res.status(404).json({ message: "Fan qatori topilmadi" });
      }
      if (isEmptySlotRow(science)) {
        return res.status(400).json({
          message:
            "Bo'sh tanlov slotini tahrirlab bo'lmaydi — avval «Fan tanlash» orqali fan tanlang",
        });
      }
      const incomingTitle = hasOwnTitle(updatedFields) ? updatedFields.title : smester?.title;
      if (String(incomingTitle ?? "").trim() === EMPTY_SLOT_TITLE) {
        return res.status(400).json({
          message: `«${EMPTY_SLOT_TITLE}» — tizim nomi, fan nomi sifatida kiritib bo'lmaydi`,
        });
      }

      const hasOwn = (obj, key) =>
        obj != null && Object.prototype.hasOwnProperty.call(obj, key);
      let hasEvaluation = false;
      let evaluationTitle = null;
      if (hasOwn(updatedFields, "evaluationType")) {
        hasEvaluation = true;
        evaluationTitle = await service.resolveAssessmentTypeTitle(
          updatedFields.evaluationType,
        );
        updatedFields.evaluationType = evaluationTitle;
      }
      if (hasOwn(smester, "evaluationType")) {
        hasEvaluation = true;
        evaluationTitle = await service.resolveAssessmentTypeTitle(
          smester.evaluationType,
        );
        smester.evaluationType = evaluationTitle;
      }
      const prepared = hasEvaluation
        ? await service.prepareEvaluationTypeWriteThrough({
            plan,
            semKey: String(semKey),
            row: science,
          })
        : null;

      const flattenObject = (obj, prefix = "") =>
        Object.entries(obj).reduce((acc, [key, value]) => {
          const newKey = prefix ? `${prefix}.${key}` : key;
          if (
            typeof value === "object" &&
            value !== null &&
            !Array.isArray(value)
          ) {
            Object.assign(acc, flattenObject(value, newKey));
          } else {
            acc[newKey] = value;
          }
          return acc;
        }, {});

      for (const [key, value] of Object.entries(flattenObject(updatedFields))) {
        science.set(key, value);
      }

      if (smester && typeof smester === "object") {
        for (const [field, value] of Object.entries(smester)) {
          science.set(field, value);
        }
      }

      if (Array.isArray(particle)) {
        for (const item of particle) {
          const { _id: particleId, ...fields } = item || {};
          const part = (science.particle || []).find(
            (p) => String(p._id) === String(particleId),
          );
          if (!part) continue;
          for (const [, value] of Object.entries(fields)) part.value = value;
        }
      }

      plan.markModified("semesters");
      await plan.save();

      const doc = await WorkingPlanModel.findOne({ _id: id })
        .select(
          "meta.serialNumber meta.code meta.title meta.particles meta.distribution.semester meta.credit.semester meta.totalCredit meta.weeklyHours meta.evaluationType semesters",
        )
        .lean()
        .exec();

      if (!doc) return res.status(404).json({ message: "not found" });

      if (prepared) {
        const wt = await service.commitEvaluationTypeWriteThrough(
          prepared,
          evaluationTitle,
        );
        if (!wt.persisted) doc.evaluationTypeWriteThrough = wt;
      }

      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Fan qatorini yangilashda xatolik"));
    }
  },

  findAllFanlarRoyxati: async (req, res, next) => {
    try {
      const { workingSchedule } = req.query;
      if (!workingSchedule) {
        return res.status(400).json({ message: "workingSchedule not found" });
      }
      let data = { ...narrowParentFilter(req.scope, "workingSchedule", workingSchedule) };

      const doc = await WorkingPlanModel.findOne(data)
        .select("semesters")
        .lean()
        .exec();
      if (!doc) return res.status(404).json({ message: "not found" });

      const blocksMap = new Map();

      const semestersObj = doc.semesters || {};
      const semKeysSorted = Object.keys(semestersObj).sort(
        (a, b) => Number(a) - Number(b),
      );

      const serialIndex = buildBlockSerialIndex(semestersObj);

      for (const semKey of semKeysSorted) {
        const semData = semestersObj[semKey];
        if (!semData) continue;

        for (const block of semData.blocks || []) {
          const blockCode = block.blockCode || "UNKNOWN";

          if (!blocksMap.has(blockCode)) {
            blocksMap.set(blockCode, {
              blockCode,
              _id: block._id,
              semKey,
              title: block.title || "",
              serialNumber: block.serialNumber || null,
              sciencesMap: new Map(),
            });
          }
          const blockEntry = blocksMap.get(blockCode);
          const blockSerials = serialIndex.get(block.blockCode || "") || [];

          for (const sci of block.sciences || []) {
            if (isDoubleCountedHeader(sci, blockSerials)) continue;
            const dedupeKey = sci.code || sci.title || String(sci._id);

            if (!blockEntry.sciencesMap.has(dedupeKey)) {
              blockEntry.sciencesMap.set(dedupeKey, {
                _id: sci._id,
                serialNumber: sci.serialNumber,
                code: sci.code,
                title: sci.title,
                science: sci.science,
                department: sci.department,
                totalCredit: 0,
                weeklyHours: sci.weeklyHours || 0,
                assessmentType: sci.assessmentType || null,
                evaluationType: sci.evaluationType || null,
              });
            }
            const sciEntry = blockEntry.sciencesMap.get(dedupeKey);
            sciEntry.totalCredit += Number(sci.totalCredit) || 0;
          }
        }
      }

      const blocks = [];
      let grandTotalCredit = 0;

      const sortedBlockCodes = [...blocksMap.keys()].sort((a, b) => {
        const ea = blocksMap.get(a);
        const eb = blocksMap.get(b);
        return String(ea.serialNumber || ea.blockCode).localeCompare(
          String(eb.serialNumber || eb.blockCode),
          undefined,
          { numeric: true },
        );
      });

      for (const blockCode of sortedBlockCodes) {
        const block = blocksMap.get(blockCode);
        const sciencesArr = [...block.sciencesMap.values()];

        const blockTotalCredit = sciencesArr.reduce(
          (s, sci) => s + (sci.totalCredit || 0),
          0,
        );
        grandTotalCredit += blockTotalCredit;

        blocks.push({
          blockCode: block.blockCode,
          _id: block._id,
          semKey: block.semKey,
          title: block.title,
          serialNumber: block.serialNumber,
          sciences: sciencesArr,
          jamiKreditlar: blockTotalCredit,
        });
      }

      return res.status(200).json({
        _id: doc._id,
        title: "III. FANLAR RO'YXATI",
        blocks,
        grandTotalCredit,
      });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find working plans", err.message),
      );
    }
  },

  getScienceInfo: async (req, res, next) => {
    try {
      const { science, semester, workingSchedule } = req.query;
      if (!science)
        return res.status(400).json({ message: "science ID majburiy" });

      const filter = {
        ...narrowParentFilter(req.scope, "workingSchedule", workingSchedule),
      };
      if (typeof filter.workingSchedule === "string") {
        filter.workingSchedule = new mongoose.Types.ObjectId(
          filter.workingSchedule,
        );
      }

      const wp = await WorkingPlanModel.findOne(filter, {
        semesters: 1,
        workingSchedule: 1,
      })
        .populate({
          path: "workingSchedule",
          select: "academicYear direction year studyPeriod",
          populate: { path: "studyPeriod", select: "title" },
        })
        .lean();
      if (!wp)
        return res
          .status(404)
          .json({ message: "Bu fan uchun ishchi o'quv reja topilmadi" });

      const semestersObj = wp.semesters || {};
      let foundBlock = null;
      let foundSci = null;
      let foundSemKey = null;

      const semKeysOrdered = semester
        ? [
            String(semester),
            ...Object.keys(semestersObj).filter((k) => k !== String(semester)),
          ]
        : Object.keys(semestersObj).sort((a, b) => Number(a) - Number(b));

      for (const semKey of semKeysOrdered) {
        const semData = semestersObj[semKey];
        if (!semData) continue;
        for (const block of semData.blocks || []) {
          const s = (block.sciences || []).find(
            (sc) => sc.science?.toString() === science,
          );
          if (s) {
            foundBlock = block;
            foundSci = s;
            foundSemKey = semKey;
            break;
          }
        }
        if (foundSci) break;
      }

      if (!foundSci) return res.status(404).json({ message: "Fan topilmadi" });

      return res.status(200).json({
        workingPlanId: wp._id,
        workingSchedule: wp.workingSchedule,
        semester: foundSemKey,
        blockCode: foundBlock.blockCode,
        blockTitle: foundBlock.title,
        scienceCode: foundSci.code,
        totalHour:
          particleValue(foundSci.particle, CANONICAL.HOUR) ||
          particleValue(foundSci.particle, "soat") ||
          particleValue(foundSci.particle, "umumiy_yuklamaning_hajmi_soat") ||
          0,
        totalCredit: foundSci.totalCredit || 0,
        weeklyHours: foundSci.weeklyHours || 0,
        assessmentType: foundSci.assessmentType || null,
        particle: foundSci.particle || [],
      });
    } catch (err) {
      return next(
        new ErrorHandler(
          400,
          "Fan ma'lumotlarini olishda xatolik",
          err.message,
        ),
      );
    }
  },

  updateScienceDepartmentByCode: async (req, res, next) => {
    try {
      const { planId, code, department } = req.body;

      if (!planId) return res.status(400).json({ message: "planId majburiy" });
      if (!code) return res.status(400).json({ message: "code majburiy" });

      const plan = await WorkingPlanModel.findOne({ _id: planId, ...req.scope });
      if (!plan) return res.status(404).json({ message: "WorkingPlan topilmadi" });

      const deptId =
        department != null
          ? new mongoose.Types.ObjectId(department)
          : null;

      let modified = 0;

      for (const [, semData] of plan.semesters) {
        if (!semData) continue;
        for (const block of semData.blocks || []) {
          for (const sci of block.sciences || []) {
            if (sci.code === code) {
              sci.department = deptId;
              modified += 1;
            }
          }
        }
      }

      plan.markModified("semesters");
      await plan.save();

      return res.status(200).json({ modified, message: "OK" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Department yangilashda xatolik", err.message),
      );
    }
  },

  generatePdf: async (req, res, next) => {
    try {
      const inScope = await WorkingPlanModel.exists({
        _id: req.params.id,
        ...req.scope,
      });
      if (!inScope) return res.status(404).json({ message: "not found" });
      return generateWorkingPlanPdf(req, res, next);
    } catch (err) {
      return next(
        new ErrorHandler(400, "PDF yaratishda xatolik", err.message),
      );
    }
  },

  getElectiveUsage: async (req, res, next) => {
    try {
      const data = await service.getElectiveRowUsage({
        planId: req.params.id,
        semKey: req.query.semKey,
        blockId: req.query.parentId,
        scienceRowId: req.query._id,
        year: req.query.year != null ? Number(req.query.year) : null,
        scope: req.scope,
      });
      return res.status(200).json({ message: "OK", data });
    } catch (err) {
      return next(wrapErr(err, "Fan bog'liqliklarini sanashda xatolik"));
    }
  },

  swapElectiveScience: async (req, res, next) => {
    try {
      const data = await service.swapElectiveScience({
        planId: req.params.id,
        semKey: req.body.semKey,
        blockId: req.body.parentId,
        scienceRowId: req.body._id,
        scienceId: req.body.scienceId,
        alternatives: req.body.alternatives,
        scope: req.scope,
      });
      return res.status(200).json({
        message: data.filled
          ? "Tanlov fani tanlandi"
          : data.persisted
            ? "Tanlov fani almashtirildi"
            : "Ishchi o'quv reja(lar) yangilandi, lekin manba o'quv rejaga yozilmadi",
        data,
      });
    } catch (err) {
      return next(wrapErr(err, "Tanlov fanini almashtirishda xatolik"));
    }
  },

  setElectiveAlternatives: async (req, res, next) => {
    try {
      const data = await service.setElectiveAlternatives({
        planId: req.params.id,
        semKey: req.body.semKey,
        blockId: req.body.blockId,
        scienceRowId: req.body.scienceRowId,
        alternatives: req.body.alternatives,
        scope: req.scope,
      });
      return res.status(200).json({
        message: data.persisted
          ? "Tanlov fani alternativlari saqlandi"
          : "Ishchi o'quv reja yangilandi, lekin manba o'quv rejaga yozilmadi",
        data,
      });
    } catch (err) {
      return next(wrapErr(err, "Alternativ fanlarni saqlashda xatolik"));
    }
  },
};
