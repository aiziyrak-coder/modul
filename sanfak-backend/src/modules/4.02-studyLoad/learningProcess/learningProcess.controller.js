const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");
const {
  parseJarayon,
  fileUrlToPath,
  parsePdfReja,
} = require("#shared/pythonParser");
const { academicStatistics } = require("#modules/4.02-studyLoad/_services/planStatistics");
const { deriveAttestationNote } = require("#modules/4.02-studyLoad/_services/attestationNote");
const {
  deriveSummaryRows,
  countKeylessRows,
} = require("#modules/4.02-studyLoad/_services/summaryRows");
const LearningProcess = require("./learningProcess.model");
const {
  withStandardLoadItems,
} = require("#modules/4.02-studyLoad/_shared/planLoadColumns");
const {
  planParticleWrites,
  findScienceRow,
  applyParticlePlan,
} = require("./particleUpdate");
const { narrowDirectionFilter } = require("./learningProcess.scope");
const { updateLearningProcessMonthWeeks } = require("./monthWeeks.service");

const withStandardLoadMeta = (doc) => {
  if (!doc || !doc.meta) return doc;
  const particles = doc.meta.particles || {};
  doc.meta.particles = {
    ...particles,
    items: withStandardLoadItems(particles.items),
  };
  return doc;
};
const escapeRegex = require("#modules/4.02-studyLoad/_shared/escapeRegex");
const stripFileUrlQuery = require("#modules/4.02-studyLoad/_shared/stripFileUrlQuery");
const humanizeXlsxParseError = require("#modules/4.02-studyLoad/_shared/humanizeXlsxParseError");
const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
const { subAddFormXlsx } = require("#modules/4.02-studyLoad/studyPlan/studyPlan.controller");
const {
  countDerivedWorkingPlans,
} = require("#modules/4.02-studyLoad/studyPlan/studyPlan.derivationGuard");
const {
  annotateBlocks,
} = require("#modules/4.02-studyLoad/_shared/planRowType");
const {
  sumKeyWeeksFromCourses,
  sumAllValuesStatistics,
  sumCoursesTotal,
} = require("#modules/4.02-studyLoad/_shared/compositionSync");
const { translaterLanguage } = require("#shared/translate");
const { default: mongoose } = require("mongoose");
const ScienceModel = require("#references/science/science.model");
const DirectionModel = require("#references/direction/direction.model");
const { resolveCourse } = require("#references/_services/courseResolver");

function summaryRowsFromParsed(summary) {
  const dropped = countKeylessRows(summary);
  if (dropped) {
    winston.warn(
      `[learningProcess] Xulosa: ${dropped} ta qator legendga mos kelmadi — tarkibiy qismlar jadvalida legend nomi qoladi`,
    );
  }
  return deriveSummaryRows(summary);
}

async function enrichCoursesWithRef(parsedCourses) {
  if (!Array.isArray(parsedCourses)) return parsedCourses;
  const out = [];
  for (const c of parsedCourses) {
    const courseRef = await resolveCourse(c.course || c.courseNum);
    out.push({ ...c, courseRef });
  }
  return out;
}


async function findDuplicateLearningProcess({
  direction,
  year,
  educationForm,
  specialization,
}) {
  if (!direction || !year) return null;
  const filter = { direction, year: String(year), archivedAt: null };
  if (educationForm) filter.educationForm = educationForm;
  if (specialization) filter.specialization = specialization;
  return LearningProcess.findOne(filter).select("_id title status year").lean();
}

function duplicateLearningProcessError(dup) {
  return new ErrorHandler(
    409,
    `Bu yo'nalish va ${dup.year}-yil uchun o'quv reja allaqachon mavjud («${dup.title}», holati: ${dup.status}). Mavjud rejani tahrirlang (faylni almashtirish) yoki avval uni o'chiring — ikkita reja bir xil yilda yuklama soatlarini ikki marta hisoblaydi.`,
    undefined,
    { existingId: String(dup._id) },
  );
}

module.exports = {
  addFromPdf: async (req, res, next) => {
    try {
      if (!req.body.file) {
        return next(new ErrorHandler(400, "PDF fayl yuklanmadi"));
      }

      const {
        direction,
        academicLevel,
        readingForm,
        educationForm,
        studyPeriod,
        specialization,
        year,
      } = req.body;

      const dupPdf = await findDuplicateLearningProcess({
        direction,
        year,
        educationForm,
        specialization,
      });
      if (dupPdf) return next(duplicateLearningProcessError(dupPdf));

      const diskYoli = fileUrlToPath(stripFileUrlQuery(req.body.file));
      const parsed = await parsePdfReja(diskYoli);

      const direcData = await DirectionModel.findById(direction).exec();

      if (!direcData)
        return next(
          new ErrorHandler(404, "Siz biriktirgan yo'nalish topilmadi"),
        );

      const enrichedCourses = await enrichCoursesWithRef(parsed.courses || []);

      const lpData = {
        title: `${direcData?.title} OʻQUV REJA`,
        direction,
        academicLevel,
        readingForm,
        educationForm,
        studyPeriod,
        specialization,
        year:
          year || parsed.header?.year || new Date().getFullYear().toString(),
        keys: parsed.keys || [],
        courses: enrichedCourses,
        allValues: parsed.allValues || {},
        comment: parsed.comment || null,
        planSource: req.body.planSource === "ministry" ? "ministry" : "institute",
        basisNote: req.body.basisNote || null,
        learningProcess: {
          keys: parsed.learningProcessKeys || [],
          title: null,
        },
        file: req.body.file,
        status: "new",
        author: req.user._id,
      };

      const lpDoc = await LearningProcess.create(lpData);

      const UNLINKED_SAMPLE_LIMIT = 50;
      const importReport = {
        total: 0,
        linked: 0,
        unlinkedCount: 0,
        unlinkedDistinct: 0,
        unlinked: [],
      };
      const seenUnlinked = new Set();

      let spDoc = null;
      if (parsed.blocks && parsed.blocks.length > 0) {
        try {
          for (const block of parsed.blocks) {
            for (const element of block.sciences) {
              const fan = element.code
                ? await ScienceModel.findOne({
                    scienceCode: element.code,
                  }).exec()
                : null;

              element.science = fan?._id ?? null;
              element.department = fan?.department ?? null;

              importReport.total += 1;
              if (fan) {
                importReport.linked += 1;
                continue;
              }

              importReport.unlinkedCount += 1;
              const key = `${element.code ?? ""}|${element.title ?? ""}`;
              if (seenUnlinked.has(key)) continue;
              seenUnlinked.add(key);
              importReport.unlinkedDistinct += 1;
              if (importReport.unlinked.length < UNLINKED_SAMPLE_LIMIT) {
                importReport.unlinked.push({
                  code: element.code ?? null,
                  title: element.title ?? null,
                });
              }
            }
          }

          spDoc = await StudyPlanModel.create({
            learningProcess: lpDoc._id,
            meta: parsed.meta || {},
            blocks: parsed.blocks,
            file: req.body.file,
          });
        } catch (err) {
          try {
            await LearningProcess.findByIdAndDelete(lpDoc._id);
          } catch (delErr) {
            winston.error(
              `[learningProcess.addFromPdf] kompensatsiya o'chirish xato (lpDoc=${lpDoc._id}): ${delErr.message}`,
            );
          }
          return next(
            new ErrorHandler(400, "O'quv reja saqlashda xatolik", err.message),
          );
        }
      }

      if (spDoc !== null) {
        return res
          .status(201)
          .json({
          message: "Muvaffaqiyatli saqlandi",
          import: importReport,
          warnings: parsed.warnings || [],
        });
      } else {
        const doc = await LearningProcess.findByIdAndDelete(lpDoc?._id);
        if (!doc) return next(new ErrorHandler(404, "o'quv reja topilmadi"));

        return res.status(400).json({
          message: "o'quv reja yaratib bo'lmadi.",
        });
      }
    } catch (err) {
      return next(new ErrorHandler(400, "PDF parse xatoligi", err.message));
    }
  },

  parseXlsx: async (req, res, next) => {
    try {
      if (!req.body.file) {
        return next(new ErrorHandler(400, "xlsx fayl yuklanmadi"));
      }

      const sheetNom = req.body.sheet || null;

      const diskYoli = fileUrlToPath(stripFileUrlQuery(req.body.file));

      const parsed = await parseJarayon(diskYoli, sheetNom);

      return res.status(200).json(parsed);
    } catch (err) {
      return next(new ErrorHandler(400, "xlsx parse xatoligi", err.message));
    }
  },

  addFromXlsx: async (req, res, next) => {
    try {
      if (!req.body.file) {
        return next(new ErrorHandler(400, "xlsx fayl yuklanmadi"));
      }

      const sheetNom = req.body.sheet || null;

      let parsed;
      try {
        const diskYoli = fileUrlToPath(stripFileUrlQuery(req.body.file));
        parsed = await parseJarayon(diskYoli, sheetNom);
      } catch (err) {
        return next(
          new ErrorHandler(
            400,
            humanizeXlsxParseError(err, "O'quv jarayoni fayli"),
          ),
        );
      }

      if (!Array.isArray(parsed.courses) || parsed.courses.length === 0) {
        return next(
          new ErrorHandler(
            400,
            "«O'quv jarayoni fayli»dan birorta ham kurs topilmadi. Fayl to'g'ri tanlanganini tekshiring (u \"O'quv reja\" fayli bilan almashtirilmaganmi?).",
          ),
        );
      }

      const statistic = academicStatistics(parsed);

      const direcData = await DirectionModel.findById(
        req.body?.direction,
      ).exec();

      if (!direcData)
        return next(
          new ErrorHandler(404, "Siz biriktirgan yo'nalish topilmadi"),
        );

      const dup = await findDuplicateLearningProcess({
        direction: req.body.direction,
        year: req.body.year,
        educationForm: req.body.educationForm,
        specialization: req.body.specialization,
      });
      if (dup) return next(duplicateLearningProcessError(dup));

      const enrichedCourses = await enrichCoursesWithRef(parsed.courses || []);

      const doc = await LearningProcess.create({
        title: `${direcData?.title} OʻQUV REJA`,
        direction: req.body.direction,
        academicLevel: req.body.academicLevel,
        readingForm: req.body.readingForm,
        educationForm: req.body.educationForm,
        studyPeriod: req.body.studyPeriod,
        specialization: req.body.specialization,
        year: req.body.year,

        keys: parsed.keys,
        courses: enrichedCourses,
        allValues: parsed.allValues,

        comment: req.body.comment,
        planSource: req.body.planSource === "ministry" ? "ministry" : "institute",
        basisNote: req.body.basisNote || null,
        attestationNote: deriveAttestationNote(parsed.summary),
        summaryRows: summaryRowsFromParsed(parsed.summary),
        learningProcess: statistic,

        file: req.body.file,
        status: "new",
        author: req.user._id,
      });

      if (!doc) return next(new ErrorHandler(400, "Saqlashda xatolik"));

      const importReport = {
        total: 0,
        linked: 0,
        unlinkedCount: 0,
        unlinkedDistinct: 0,
        unlinked: [],
        izoh: null,
      };

      try {
        await subAddFormXlsx({
          learningProcess: doc?._id,
          file: req.body.planFile,
          report: importReport,
        });
      } catch (err) {
        await LearningProcess.findByIdAndDelete(doc?._id);
        return next(new ErrorHandler(400, err.message));
      }

      if (!String(req.body.comment || "").trim() && importReport.izoh) {
        await LearningProcess.updateOne(
          { _id: doc._id },
          { comment: importReport.izoh },
        );
      }

      return res
        .status(201)
        .json({
          message: "Muvaffaqiyatli saqlandi",
          import: importReport,
          warnings: parsed.warnings || [],
        });
    } catch (err) {
      return next(new ErrorHandler(400, "Saqlashda xatolik", err.message));
    }
  },

  findAll: async (req, res, next) => {
    try {
      const { search, direction, year, status } = req.query;
      const filter = { ...narrowDirectionFilter(req.scope, direction) };

      if (search) {
        filter.title = { $regex: new RegExp(escapeRegex(search), "i") };
      }

      if (year) filter.year = year;

      if (status) filter.status = status;

      let docs = await LearningProcess.find(filter, {
        createdAt: 0,
        updatedAt: 0,
      })
        .populate({
          path: "direction",
          select: "title",
          strictPopulate: true,
        })
        .populate({
          path: "academicLevel",
          select: "title",
          strictPopulate: true,
        })
        .populate({
          path: "specialization",
          select: "title",
          strictPopulate: true,
        })
        .populate({
          path: "readingForm",
          select: "title",
          strictPopulate: true,
        })
        .populate({
          path: "educationForm",
          select: "title",
          strictPopulate: true,
        })
        .populate({
          path: "studyPeriod",
          select: "title",
          strictPopulate: true,
        })
        .select([
          "-keys",
          "-allValues",
          "-comment",
          "-learningProcess",
          "-courses",
        ])
        .exec();

      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Ro'yxatni olishda xatolik", err.message),
      );
    }
  },

  paginate: async (req, res, next) => {
    try {
      const { direction, year, search, status, page, limit } = req.query;
      const filter = { ...narrowDirectionFilter(req.scope, direction) };

      if (search) {
        filter.title = { $regex: new RegExp(escapeRegex(search), "i") };
      }

      if (year) filter.year = year;

      if (status) filter.status = status;

      const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
        select: [
          "-updatedAt",
          "-keys",
          "-allValues",
          "-comment",
          "-learningProcess",
          "-courses",
        ],
        lean: true,
        populate: [
          {
            path: "direction",
            select: "title",
            strictPopulate: true,
          },
          {
            path: "readingForm",
            select: "title",
            strictPopulate: true,
          },
          {
            path: "specialization",
            select: "title",
            strictPopulate: true,
          },
          {
            path: "academicLevel",
            select: "title",
            strictPopulate: true,
          },
          {
            path: "educationForm",
            select: "title",
            strictPopulate: true,
          },
          {
            path: "studyPeriod",
            select: "title",
            strictPopulate: true,
          },
        ],
      };

      let doc = await LearningProcess.paginate(filter, options);

      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Paginatsiyada xatolik", err.message));
    }
  },

  findOne: async (req, res, next) => {
    try {
      let doc = await LearningProcess.findOne(
        { _id: req.params.id, ...req.scope },
        {
          createdAt: 0,
          updatedAt: 0,
        },
      )
        .populate({
          path: "direction",
          select: "title",
          strictPopulate: true,
        })
        .populate({
          path: "academicLevel",
          select: "title",
          strictPopulate: true,
        })
        .populate({
          path: "specialization",
          select: "title",
          strictPopulate: true,
        })
        .populate({
          path: "readingForm",
          select: "title",
          strictPopulate: true,
        })
        .populate({
          path: "educationForm",
          select: "title",
          strictPopulate: true,
        })
        .populate({
          path: "studyPeriod",
          select: "title",
          strictPopulate: true,
        })
        .exec();

      if (!doc) return next(new ErrorHandler(404, "Topilmadi"));
      const subDoc = await StudyPlanModel.findOne({
        learningProcess: doc._id,
      })
        .select("file")
        .exec();

      const result = doc.toObject();
      result.planFile = subDoc?.file || null;

      return res.status(200).json(result);
    } catch (err) {
      return next(new ErrorHandler(400, "Olishda xatolik", err.message));
    }
  },

  fullUpdate: async (req, res, next) => {
    try {
      const { id } = req.params;

      const findDoc = await LearningProcess.findOne({
        _id: id,
        status: "new",
        ...req.scope,
      }).exec();

      if (!findDoc) {
        return next(
          new ErrorHandler(
            400,
            "siz tanlagan o'quv reja mavjud emas yoki statusi tahrirlashdan o'tgan",
          ),
        );
      }

      const direcData = await DirectionModel.findById(
        req.body?.direction,
      ).exec();

      if (!direcData)
        return next(
          new ErrorHandler(404, "Siz biriktirgan yo'nalish topilmadi"),
        );

      if (findDoc.planSource === "ministry") {
        const nextBasisNote =
          req.body.basisNote !== undefined
            ? req.body.basisNote
            : findDoc.basisNote;
        if (!nextBasisNote || !String(nextBasisNote).trim()) {
          return next(
            new ErrorHandler(400, "Vazirlik rejasida asos izohi majburiy"),
          );
        }
      }

      if (!req.body.file) {
        const doc = await LearningProcess.findByIdAndUpdate(
          id,
          {
            title: `${direcData?.title} OʻQUV REJA`,
            direction: req.body.direction,
            academicLevel: req.body.academicLevel,
            readingForm: req.body.readingForm,
            educationForm: req.body.educationForm,
            studyPeriod: req.body.studyPeriod,
            specialization: req.body.specialization,
            year: req.body.year,
            comment: req.body.comment,
            basisNote: req.body.basisNote,
          },
          { new: true },
        )
          .populate({
            path: "direction",
            select: "title",
            strictPopulate: true,
          })
          .populate({
            path: "academicLevel",
            select: "title",
            strictPopulate: true,
          })
          .populate({
            path: "specialization",
            select: "title",
            strictPopulate: true,
          })
          .populate({
            path: "readingForm",
            select: "title",
            strictPopulate: true,
          })
          .populate({
            path: "educationForm",
            select: "title",
            strictPopulate: true,
          })
          .populate({
            path: "studyPeriod",
            select: "title",
            strictPopulate: true,
          });

        if (!doc) return next(new ErrorHandler(404, "o'quv reja topilmadi"));
        const subDoc = await StudyPlanModel.findOne({
          learningProcess: doc._id,
        })
          .select("file")
          .exec();

        const result = doc.toObject();
        result.planFile = subDoc?.file || null;

        if (doc) {
          return res.status(200).json(result);
        }
      }

      const sheetNom = req.body.sheet || null;

      let parsed;
      try {
        const diskYoli = fileUrlToPath(stripFileUrlQuery(req.body.file));
        parsed = await parseJarayon(diskYoli, sheetNom);
      } catch (err) {
        return next(
          new ErrorHandler(
            400,
            humanizeXlsxParseError(err, "O'quv jarayoni fayli"),
          ),
        );
      }

      if (!Array.isArray(parsed.courses) || parsed.courses.length === 0) {
        return next(
          new ErrorHandler(
            400,
            "«O'quv jarayoni fayli»dan birorta ham kurs topilmadi. Fayl to'g'ri tanlanganini tekshiring (u \"O'quv reja\" fayli bilan almashtirilmaganmi?).",
          ),
        );
      }

      const statistic = academicStatistics(parsed);

      const enrichedCourses = await enrichCoursesWithRef(parsed.courses || []);

      const doc = await LearningProcess.findByIdAndUpdate(
        id,
        {
          title: `${direcData?.title} OʻQUV REJA`,
          direction: req.body.direction,
          academicLevel: req.body.academicLevel,
          readingForm: req.body.readingForm,
          educationForm: req.body.educationForm,
          studyPeriod: req.body.studyPeriod,
          specialization: req.body.specialization,
          year: req.body.year,

          keys: parsed.keys,
          courses: enrichedCourses,
          allValues: parsed.allValues,

          comment: req.body.comment,
          basisNote: req.body.basisNote,
          attestationNote: deriveAttestationNote(parsed.summary),
          summaryRows: summaryRowsFromParsed(parsed.summary),
          learningProcess: statistic,

          file: req.body.file,
          status: "new",
          author: req.user._id,
        },
        { new: true },
      )
        .populate({
          path: "direction",
          select: "title",
          strictPopulate: true,
        })
        .populate({
          path: "academicLevel",
          select: "title",
          strictPopulate: true,
        })
        .populate({
          path: "specialization",
          select: "title",
          strictPopulate: true,
        })
        .populate({
          path: "readingForm",
          select: "title",
          strictPopulate: true,
        })
        .populate({
          path: "educationForm",
          select: "title",
          strictPopulate: true,
        })
        .populate({
          path: "studyPeriod",
          select: "title",
          strictPopulate: true,
        });

      if (!doc) return next(new ErrorHandler(404, "o'quv reja topilmadi"));

      if (!req.body.planFile) {
        const subDoc = await StudyPlanModel.findOne({
          learningProcess: doc._id,
        })
          .select("file")
          .exec();

        const result = doc.toObject();
        result.planFile = subDoc?.file || null;
        return res.status(200).json(result);
      }

      const oldPlans = await StudyPlanModel.find({ learningProcess: doc._id })
        .select("_id")
        .lean();
      const oldPlanIds = oldPlans.map((p) => p._id);

      const derivedCount = await countDerivedWorkingPlans(oldPlanIds);
      if (derivedCount > 0) {
        return next(
          new ErrorHandler(
            409,
            `Ushbu o'quv rejadan ${derivedCount} ta ishchi o'quv reja (working plan) allaqachon generatsiya qilingan, shuning uchun "O'quv reja" faylini almashtirib bo'lmaydi. Avval ishchi rejalarni o'chiring yoki qayta generatsiya qiling.`,
          ),
        );
      }

      let newSubDoc;
      const subReport = { izoh: null };
      try {
        newSubDoc = await subAddFormXlsx({
          learningProcess: doc._id,
          file: req.body.planFile,
          report: subReport,
        });
      } catch (err) {
        return next(new ErrorHandler(400, err.message));
      }

      if (!newSubDoc) {
        return res.status(400).json({
          message: "O'quv reja yangilab bo'lmadi.",
        });
      }

      if (oldPlanIds.length > 0) {
        await StudyPlanModel.deleteMany({ _id: { $in: oldPlanIds } });
      }

      if (!String(doc.comment || "").trim() && subReport.izoh) {
        doc.comment = subReport.izoh;
        await LearningProcess.updateOne(
          { _id: doc._id },
          { comment: subReport.izoh },
        );
      }

      const result = doc.toObject();
      result.planFile = newSubDoc.file || null;
      return res.status(200).json(result);
    } catch (err) {
      return next(new ErrorHandler(400, "Yangilashda xatolik", err.message));
    }
  },

  updateMonthWeeks: async (req, res, next) => {
    try {
      const data = await updateLearningProcessMonthWeeks({
        id: req.params.id,
        scope: req.scope,
        counts: req.body.counts,
        applyToDraftSchedules: req.body.applyToDraftSchedules,
      });
      return res.status(200).json({ message: "Taqsimot saqlandi", data });
    } catch (err) {
      if (err instanceof ErrorHandler) return next(err);
      return next(new ErrorHandler(400, "Taqsimotni saqlab bo'lmadi", err.message));
    }
  },

  update: async (req, res, next) => {
    try {
      const { id } = req.params;
      const owner = await LearningProcess.exists({ _id: id, ...req.scope });
      if (!owner) return next(new ErrorHandler(404, "Topilmadi"));

      const { courseId, weeks, total, statistics, allValues } = req.body;

      if (!courseId && allValues) {
        const plan = await LearningProcess.findById(id);
        if (!plan) return next(new ErrorHandler(404, "O'quv reja topilmadi"));

        const titleToValue = {};
        allValues.statistics.forEach((stat) => {
          titleToValue[stat.title] = stat.value;
        });

        plan.allValues.statistics = plan.allValues.statistics.map((stat) => {
          if (titleToValue[stat.title] !== undefined) {
            return { ...stat.toObject(), value: titleToValue[stat.title] };
          }
          return stat;
        });

        if (allValues.total !== undefined) {
          plan.allValues.total = allValues.total;
        }

        plan.learningProcess.keys = plan.learningProcess.keys.map((key) => {
          const keyObj = key.toObject ? key.toObject() : { ...key };

          if (
            keyObj.title === "JAMI" &&
            titleToValue["Hammasi"] !== undefined
          ) {
            return { ...keyObj, week: titleToValue["Hammasi"] };
          }

          if (titleToValue[keyObj.title] !== undefined) {
            return { ...keyObj, week: titleToValue[keyObj.title] };
          }

          return keyObj;
        });

        plan.markModified("allValues");
        plan.markModified("learningProcess");

        await plan.save();

        return res.status(200).json(plan);
      }

      const setObj = {};

      if (total !== undefined) {
        setObj["courses.$[course].total"] = total;
      }

      if (weeks) {
        setObj["courses.$[course].weeks"] = weeks;
      }

      let doc = await LearningProcess.findByIdAndUpdate(
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
          await LearningProcess.findByIdAndUpdate(
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
          await LearningProcess.findByIdAndUpdate(
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

        const freshDoc = await LearningProcess.findById(id);
        const courses = (freshDoc?.courses || []).map((c) =>
          c.toObject ? c.toObject() : c,
        );
        if (freshDoc && courses.length > 0) {
          const planKeys = (freshDoc.learningProcess?.keys || []).map((k) =>
            k.toObject ? k.toObject() : k,
          );
          const allStats = (freshDoc.allValues?.statistics || []).map((s) =>
            s.toObject ? s.toObject() : s,
          );

          await LearningProcess.findByIdAndUpdate(id, {
            $set: {
              "learningProcess.keys": sumKeyWeeksFromCourses(planKeys, courses),
              "allValues.statistics": sumAllValuesStatistics(allStats, courses),
              "allValues.total": sumCoursesTotal(courses),
            },
          });
        }
      }

      const updatedDoc = await LearningProcess.findById(id);
      return res.status(200).json(updatedDoc);
    } catch (err) {
      return next(new ErrorHandler(400, "Yangilashda xatolik", err.message));
    }
  },

  updateSpecialParts: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { learningProcess } = req.body;

      const $set = {};
      const arrayFilters = [];

      if (learningProcess?.keys?.length) {
        learningProcess.keys.forEach((updatedKey, index) => {
          const f = `k${index}`;
          arrayFilters.push({
            [`${f}._id`]: new mongoose.Types.ObjectId(updatedKey._id),
          });

          if (updatedKey.week !== undefined) {
            $set[`learningProcess.keys.$[${f}].week`] = updatedKey.week;
          }
          if (updatedKey.semester !== undefined) {
            $set[`learningProcess.keys.$[${f}].semester`] = updatedKey.semester;
          }
        });
      }

      if (!Object.keys($set).length) {
        return next(new ErrorHandler(400, "Hech qanday o'zgartirish yo'q"));
      }

      const doc = await LearningProcess.findOneAndUpdate(
        { _id: id, ...req.scope },
        { $set },
        {
          new: true,
          runValidators: true,
          ...(arrayFilters.length && { arrayFilters }),
        },
      );

      if (!doc) return next(new ErrorHandler(404, "Topilmadi"));
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Yangilashda xatolik", err.message));
    }
  },

  updateSpecialPartsTitle: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { learningProcess } = req.body;

      const $set = {};
      const arrayFilters = [];

      if (learningProcess) {
        if (learningProcess.title !== undefined) {
          $set[`learningProcess.title`] = learningProcess.title;
        }
      }

      if (!Object.keys($set).length) {
        return next(new ErrorHandler(400, "Hech qanday o'zgartirish yo'q"));
      }

      const doc = await LearningProcess.findOneAndUpdate(
        { _id: id, ...req.scope },
        { $set },
        {
          new: true,
          runValidators: true,
          ...(arrayFilters.length && { arrayFilters }),
        },
      );

      if (!doc) return next(new ErrorHandler(404, "Topilmadi"));
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Yangilashda xatolik", err.message));
    }
  },

  findAllStudyPlan: async (req, res, next) => {
    try {
      const { learningProcess } = req.query;
      if (!learningProcess) {
        return res.status(400).json({ message: "workingSchedule not found" });
      }

      const owner = await LearningProcess.findOne(
        { _id: learningProcess, ...req.scope },
        { _id: 1 },
      ).lean();
      if (!owner) return res.status(404).json({ message: "not found" });

      let data = { learningProcess };

      let docs = await StudyPlanModel.findOne(data).lean().exec();

      if (!docs) return res.status(404).json({ message: "not found" });

      return res.status(200).json(withStandardLoadMeta(annotateBlocks(docs)));
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find working plans", err.message),
      );
    }
  },

  updateStudyPlanScince: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { parentId, _id, particle, smester, ...updatedFields } = req.body;

      const spOwner = await StudyPlanModel.findById(id, {
        learningProcess: 1,
      }).lean();
      if (!spOwner) return res.status(404).json({ message: "not found" });
      const inScope = await LearningProcess.exists({
        _id: spOwner.learningProcess,
        ...req.scope,
      });
      if (!inScope) return res.status(404).json({ message: "not found" });

      const setFields = {};

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

      const flatFields = flattenObject(updatedFields);
      Object.entries(flatFields).forEach(([key, value]) => {
        setFields[`blocks.$[block].sciences.$[science].${key}`] = value;
      });

      if (smester && typeof smester === "object") {
        Object.entries(smester).forEach(([semNum, hourValue]) => {
          setFields[
            `blocks.$[block].sciences.$[science].semesters.${semNum}.hour`
          ] = hourValue;
        });
      }

      const mainUpdate = await StudyPlanModel.findOneAndUpdate(
        {
          _id: id,
          "blocks._id": new mongoose.Types.ObjectId(parentId),
          "blocks.sciences._id": new mongoose.Types.ObjectId(_id),
        },
        { $set: setFields },
        {
          arrayFilters: [
            { "block._id": new mongoose.Types.ObjectId(parentId) },
            { "science._id": new mongoose.Types.ObjectId(_id) },
          ],
          new: true,
        },
      );

      if (!mainUpdate) return res.status(404).json({ message: "not found" });

      if (Array.isArray(particle)) {
        const sciRow = findScienceRow(mainUpdate, parentId, _id);
        const plan = planParticleWrites(sciRow && sciRow.particle, particle);
        await applyParticlePlan(StudyPlanModel, { id, parentId, sciId: _id, plan });
      }

      return res.status(200).json(mainUpdate);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to update science", err.message),
      );
    }
  },

  delete: async (req, res, next) => {
    try {
      const existing = await LearningProcess.findOne({
        _id: req.params.id,
        ...req.scope,
      });
      if (!existing) return next(new ErrorHandler(404, "Topilmadi"));

      if (["approved", "in_review"].includes(existing.status)) {
        return next(
          new ErrorHandler(
            400,
            `O'quv reja "${existing.status}" holatida — /:id/archive endpoint'idan foydalaning`,
          ),
        );
      }

      await existing.softDelete(req.user?._id, req.body?.reason);
      return res
        .status(200)
        .json({ message: "Muvaffaqiyatli o'chirildi", _id: existing._id });
    } catch (err) {
      return next(new ErrorHandler(400, "O'chirishda xatolik", err.message));
    }
  },

  archive: async (req, res, next) => {
    try {
      const doc = await LearningProcess.findOne({
        _id: req.params.id,
        ...req.scope,
      });
      if (!doc) return next(new ErrorHandler(404, "Topilmadi"));

      if (doc.archivedAt) {
        return next(new ErrorHandler(400, "Allaqachon arxivlangan"));
      }

      await doc.archive(req.user?._id, req.body?.reason);
      return res.status(200).json({ message: "Arxivlandi", _id: doc._id });
    } catch (err) {
      return next(new ErrorHandler(400, "Arxivlashda xatolik", err.message));
    }
  },

  restore: async (req, res, next) => {
    try {
      const doc = await LearningProcess.findOneWithDeleted({
        _id: req.params.id,
        ...req.scope,
      });
      if (!doc) return next(new ErrorHandler(404, "Topilmadi"));

      if (doc.deletedAt) await doc.restore();
      if (doc.archivedAt) await doc.unarchive();

      return res.status(200).json({ message: "Qaytarildi", _id: doc._id });
    } catch (err) {
      return next(new ErrorHandler(400, "Qaytarishda xatolik", err.message));
    }
  },

  approve: async (req, res, next) => {
    try {
      const doc = await LearningProcess.findOneAndUpdate(
        { _id: req.params.id, ...req.scope },
        { status: "created" },
        { new: true },
      );
      if (!doc) return next(new ErrorHandler(404, "Topilmadi"));
      return res.status(200).json({ message: "Tasdiqlandi" });
    } catch (err) {
      return next(new ErrorHandler(400, "Tasdiqlashda xatolik", err.message));
    }
  },
};
