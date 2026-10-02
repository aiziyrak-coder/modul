const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");
const {
  parseReja,
  parsePdfReja,
  fileUrlToPath,
} = require("#shared/pythonParser");
const StudyPlanModel = require("./studyPlan.model");
const { countDerivedWorkingPlans } = require("./studyPlan.derivationGuard");
const escapeRegex = require("#modules/4.02-studyLoad/_shared/escapeRegex");
const stripFileUrlQuery = require("#modules/4.02-studyLoad/_shared/stripFileUrlQuery");
const humanizeXlsxParseError = require("#modules/4.02-studyLoad/_shared/humanizeXlsxParseError");
const {
  classifyRows,
  isCountableSubject,
  annotateBlocks,
} = require("#modules/4.02-studyLoad/_shared/planRowType");
const ScienceModel = require("#references/science/science.model");
const {
  buildCatalog,
  lookupCanonical,
} = require("#modules/4.02-studyLoad/_services/scienceLinker");
const { translaterLanguage } = require("#shared/translate");
const {
  enrichMetaWithSlugRefs,
  populateAllSlugRefs,
} = require("#references/_services/educationActivityResolver");
const {
  buildSemesterTable,
  buildBlocksTable,
} = require("#modules/4.02-studyLoad/_services/semesterBreakdown");
const {
  generateStudyPlanPdf,
} = require("#modules/4.02-studyLoad/_pdf/studyPlan.pdf");
const service = require("./studyPlan.service");

const wrapErr = (err, message) => {
  if (err.statusCode) return err;
  winston.error(`[studyPlan] ${message}: ${err.message}`);
  return new ErrorHandler(500, message);
};

module.exports = {
  parseXlsx: async (req, res, next) => {
    try {
      if (!req.body.file) {
        return next(new ErrorHandler(400, "xlsx fayl yuklanmadi"));
      }
      const diskYoli = fileUrlToPath(req.body.file);
      const parsed = await parseReja(diskYoli, req.body.sheet || null);
      return res.status(200).json(parsed);
    } catch (err) {
      return next(new ErrorHandler(400, "xlsx parse xatoligi", err.message));
    }
  },

  subAddFormXlsx: async (data) => {
    if (!data.file) throw new Error("planFile yuklanmadi");
    if (!data.learningProcess) throw new Error("learningProcess ID majburiy");

    let parsed;
    try {
      const diskYoli = fileUrlToPath(stripFileUrlQuery(data.file));
      parsed = await parseReja(diskYoli, data.sheet || null);
    } catch (err) {
      throw new Error(humanizeXlsxParseError(err, "O'quv reja fayli"));
    }

    if (!Array.isArray(parsed.blocks) || parsed.blocks.length === 0) {
      throw new Error(
        "«O'quv reja fayli»dan birorta ham blok/fan topilmadi. Fayl to'g'ri tanlanganini tekshiring (u \"O'quv jarayoni\" fayli bilan almashtirilmaganmi?).",
      );
    }

    const report = data.report || null;

    if (report) report.izoh = parsed.meta?.izoh || null;
    const UNLINKED_SAMPLE_LIMIT = 50;
    const seenUnlinked = new Set();

    const catalog = buildCatalog(
      await ScienceModel.find({ scienceCode: { $nin: [null, ""] } })
        .select("_id scienceCode department")
        .lean(),
    );

    for (const block of parsed.blocks) {
      const rowTypes = classifyRows(block.sciences);

      for (const [index, element] of block.sciences.entries()) {
        const fan = element.code ? lookupCanonical(catalog, element.code) : null;

        element.science = fan?._id ?? null;
        element.department = fan?.department ?? null;

        if (!report || !isCountableSubject(rowTypes[index])) continue;

        report.total += 1;
        if (fan) {
          report.linked += 1;
          continue;
        }

        report.unlinkedCount += 1;
        const key = `${element.code ?? ""}|${element.title ?? ""}`;
        if (seenUnlinked.has(key)) continue;
        seenUnlinked.add(key);
        report.unlinkedDistinct += 1;
        if (report.unlinked.length < UNLINKED_SAMPLE_LIMIT) {
          report.unlinked.push({
            code: element.code ?? null,
            title: element.title ?? null,
          });
        }
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

  addFromXlsx: async (req, res, next) => {
    try {
      if (!req.body.file) {
        return next(new ErrorHandler(400, "xlsx fayl yuklanmadi"));
      }
      if (!req.body.learningProcess) {
        return next(new ErrorHandler(400, "learningProcess ID majburiy"));
      }

      const diskYoli = fileUrlToPath(req.body.file);
      const parsed = await parseReja(diskYoli, req.body.sheet || null);

      const catalog = buildCatalog(
        await ScienceModel.find({ scienceCode: { $nin: [null, ""] } })
          .select("_id scienceCode department")
          .lean(),
      );

      for (const block of parsed.blocks) {
        for (const element of block.sciences) {
          const fan = lookupCanonical(catalog, element.code);

          element.science = fan?._id ?? null;
          element.department = fan?.department ?? null;
        }
      }

      const doc = await StudyPlanModel.create({
        learningProcess: req.body.learningProcess,
        meta: parsed.meta,
        blocks: parsed.blocks,
        file: req.body.file,
      });

      return res.status(201).json({ message: "Muvaffaqiyatli saqlandi" });
    } catch (err) {
      return next(new ErrorHandler(400, "Saqlashda xatolik", err.message));
    }
  },

  addFromPdf: async (req, res, next) => {
    try {
      if (!req.body.file) {
        return next(new ErrorHandler(400, "PDF fayl yuklanmadi"));
      }
      if (!req.body.learningProcess) {
        return next(new ErrorHandler(400, "learningProcess ID majburiy"));
      }

      const diskYoli = fileUrlToPath(req.body.file);
      const parsed = await parsePdfReja(diskYoli);

      const catalog = buildCatalog(
        await ScienceModel.find({ scienceCode: { $nin: [null, ""] } })
          .select("_id scienceCode department")
          .lean(),
      );

      for (const block of parsed.blocks) {
        for (const element of block.sciences) {
          const fan = lookupCanonical(catalog, element.code);

          element.science = fan?._id ?? null;
          element.department = fan?.department ?? null;
        }
      }

      const doc = await StudyPlanModel.create({
        learningProcess: req.body.learningProcess,
        meta: parsed.meta,
        blocks: parsed.blocks,
        file: req.body.file,
      });

      return res.status(201).json({
        message: "PDF muvaffaqiyatli parse qilindi va saqlandi",
        _id: doc._id,
        header: parsed.header,
        blocksCount: parsed.blocks.length,
        sciencesCount: parsed.blocks.reduce((s, b) => s + b.sciences.length, 0),
      });
    } catch (err) {
      return next(new ErrorHandler(400, "PDF parse xatoligi", err.message));
    }
  },

  addStudyPlan: async (req, res, next) => {
    try {
      const doc = await new StudyPlanModel(req.body).save();
      if (!doc) return res.status(404).json({ message: "Failed to save" });
      return res.status(201).json({ message: "successfully created" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to add study plan", err.message),
      );
    }
  },

  findAllStudyPlans: async (req, res, next) => {
    try {
      const { search, active } = req.query;
      let data = { ...req.scope };
      if (search)
        data["title"] = { $regex: new RegExp(escapeRegex(search), "i") };
      if (active) data["active"] = active;
      let docs = await StudyPlanModel.find(data, {
        createdAt: 0,
        updatedAt: 0,
      })
        .lean()
        .exec();
      if (!docs) return res.status(404).json({ message: "not found" });

      for (const d of docs) await populateAllSlugRefs(d);
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find study plans", err.message),
      );
    }
  },

  paginateStudyPlans: async (req, res, next) => {
    try {
      const { search, active, page, limit } = req.query;
      let data = { ...req.scope };
      if (search)
        data["title"] = { $regex: new RegExp(escapeRegex(search), "i") };
      if (active) data["active"] = active;
      const options = {
        limit: parseInt(limit),
        page: parseInt(page),
        select: ["-updatedAt"],
        lean: true,
        populate: {
          path: "learningProcess",
          select: "title year direction",
          populate: { path: "direction", select: "title" },
        },
      };
      let doc = await StudyPlanModel.paginate(data, options);
      if (!doc) return res.status(404).json({ message: "not found" });

      if (Array.isArray(doc.docs)) {
        for (const d of doc.docs) await populateAllSlugRefs(d);
      }
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to paginate study plans", err.message),
      );
    }
  },

  findOneStudyPlan: async (req, res, next) => {
    try {
      let doc = await StudyPlanModel.findOne(
        { _id: req.params.id, ...req.scope },
        {
          createdAt: 0,
          updatedAt: 0,
        },
      )
        .lean()
        .exec();
      if (!doc) return res.status(404).json({ message: "not found" });

      await populateAllSlugRefs(doc);
      return res.status(200).json(annotateBlocks(doc));
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find study plan", err.message),
      );
    }
  },

  updateStudyPlan: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { blockCode, scienceCode, ...updatedFields } = req.body;

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

      const doc = await StudyPlanModel.findOneAndUpdate(
        {
          _id: id,
          ...req.scope,
          blocks: { $elemMatch: { blockCode, "sciences.code": scienceCode } },
        },
        {
          $set: Object.fromEntries(
            Object.entries(flatFields).map(([key, value]) => [
              `blocks.$[block].sciences.$[science].${key}`,
              value,
            ]),
          ),
        },
        {
          arrayFilters: [
            { "block.blockCode": blockCode },
            { "science.code": scienceCode },
          ],
          new: true,
        },
      );

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to update science", err.message),
      );
    }
  },

  linkStudyPlanScience: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { blockCode, scienceCode, scienceId } = req.body;

      const catalog = await ScienceModel.findById(scienceId)
        .select("department")
        .lean();
      if (!catalog) {
        return next(new ErrorHandler(404, "Katalog fani topilmadi"));
      }

      const doc = await StudyPlanModel.findOneAndUpdate(
        {
          _id: id,
          ...req.scope,
          blocks: { $elemMatch: { blockCode, "sciences.code": scienceCode } },
        },
        {
          $set: {
            "blocks.$[block].sciences.$[science].science": scienceId,
            "blocks.$[block].sciences.$[science].department": catalog.department,
          },
        },
        {
          arrayFilters: [
            { "block.blockCode": blockCode },
            { "science.code": scienceCode },
          ],
          new: true,
        },
      );

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ message: "successfully linked" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to link science", err.message),
      );
    }
  },

  deleteStudyPlan: async (req, res, next) => {
    try {
      const doc = await StudyPlanModel.findOne({
        _id: req.params.id,
        ...req.scope,
      });
      if (!doc) return res.status(404).json({ message: "not found" });

      const derivedCount = await countDerivedWorkingPlans(doc._id);
      if (derivedCount > 0) {
        return res.status(409).json({
          message: `Bu o'quv rejadan ${derivedCount} ta ishchi o'quv reja (working plan) allaqachon generatsiya qilingan, shuning uchun uni o'chirib bo'lmaydi. Avval ishchi rejalarni o'chiring yoki qayta generatsiya qiling.`,
        });
      }

      await doc.deleteOne();
      return res
        .status(200)
        .json({ message: `successfully deleted ${doc?._id}` });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to delete study plan", err.message),
      );
    }
  },

  getBySemester: async (req, res, next) => {
    try {
      const { id, n } = req.params;
      const semNum = parseInt(n, 10);
      if (!semNum || semNum < 1) {
        return next(new ErrorHandler(400, "Noto'g'ri semestr raqami"));
      }

      const plan = await StudyPlanModel.findOne({ _id: id, ...req.scope })
        .populate("learningProcess", "title year direction")
        .lean();

      if (!plan) {
        return next(new ErrorHandler(404, "StudyPlan topilmadi"));
      }

      await populateAllSlugRefs(plan);
      const result = buildSemesterTable(plan, semNum);

      return res.status(200).json({
        studyPlan: {
          _id: plan._id,
          file: plan.file,
          learningProcess: plan.learningProcess,
        },
        ...result,
      });
    } catch (err) {
      return next(new ErrorHandler(400, "Semester jadval xatosi", err.message));
    }
  },

  getByBlocks: async (req, res, next) => {
    try {
      const { id } = req.params;

      const plan = await StudyPlanModel.findOne({ _id: id, ...req.scope })
        .populate("learningProcess", "title year direction")
        .lean();

      if (!plan) {
        return next(new ErrorHandler(404, "StudyPlan topilmadi"));
      }

      await populateAllSlugRefs(plan);
      const result = buildBlocksTable(plan);

      return res.status(200).json({
        studyPlan: {
          _id: plan._id,
          file: plan.file,
          learningProcess: plan.learningProcess,
        },
        ...result,
      });
    } catch (err) {
      return next(new ErrorHandler(400, "Bloklar jadvali xatosi", err.message));
    }
  },

  generatePdf: async (req, res, next) => {
    try {
      const inScope = await StudyPlanModel.exists({
        _id: req.params.id,
        ...req.scope,
      });
      if (!inScope) return res.status(404).json({ message: "not found" });
      return generateStudyPlanPdf(req, res, next);
    } catch (err) {
      return next(
        new ErrorHandler(400, "PDF yaratishda xatolik", err.message),
      );
    }
  },

  addElectiveRow: async (req, res, next) => {
    try {
      const result = await service.addElectiveRow({
        id: req.params.id,
        scope: req.scope,
        body: req.body,
      });
      return res.status(201).json({
        message: "Tanlov fani qatori qo'shildi",
        data: result,
      });
    } catch (err) {
      return next(wrapErr(err, "Tanlov fani qatorini qo'shishda xatolik"));
    }
  },

  removeElectiveRow: async (req, res, next) => {
    try {
      const result = await service.removeElectiveRow({
        id: req.params.id,
        rowId: req.params.rowId,
        scope: req.scope,
      });
      return res.status(200).json({
        message: "Tanlov fani qatori o'chirildi",
        data: result,
      });
    } catch (err) {
      return next(wrapErr(err, "Tanlov fani qatorini o'chirishda xatolik"));
    }
  },
};
