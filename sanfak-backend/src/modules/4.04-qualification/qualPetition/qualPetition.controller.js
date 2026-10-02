const { ErrorHandler } = require("#shared/error");
const QualPetition = require("./qualPetition.model");
const QualListener = require("#modules/4.04-qualification/_shared/qualListener.model");
const QualCourseSubscription = require("#modules/4.04-qualification/qualCourseSubscription/qualCourseSubscription.model");
const QualCourse = require("#modules/4.04-qualification/qualCourse/qualCourse.model");
const QualContract = require("#modules/4.04-qualification/qualContract/qualContract.model");
const User = require("#modules/4.01-auth/user/user.model");
const Role = require("#modules/4.01-auth/role/role.model");
const {
  getPassport,
  listenerScope,
} = require("#modules/4.04-qualification/_shared/listenerContext");
const {
  buildContractPdf,
} = require("#modules/4.04-qualification/_pdf/contract.pdf");
const { saveAndUpdatePdf } = require("#shared/pdfGenerators/pdfHelpers");
const { resolvePublicBaseUrl } = require("#shared/publicBaseUrl");
const winston = require("#shared/winston.logger");

const TINGLOVCHI_ROLE_TITLE = "malaka_tinglovchi";

async function resolveOneIdIdentity(req) {
  const u = (req && req.user) || {};
  let src = u;
  let cardFullName = null;

  if (req && req.listenerId) {
    const card = await QualListener.findById(req.listenerId)
      .select("passport fullName")
      .lean();
    if (card && card.passport) {
      cardFullName = card.fullName || null;
      const extra = await User.findOne({ oneIdPin: card.passport })
        .select(
          "firstName lastName middleName oneIdPin passportSeria passportNumber",
        )
        .lean();
      src = extra || { oneIdPin: card.passport };
    }
  } else if (u._id) {
    const full = await User.findById(u._id)
      .select(
        "firstName lastName middleName oneIdPin passportSeria passportNumber",
      )
      .lean();
    if (full) src = full;
  }

  const fullName =
    [src.lastName, src.firstName, src.middleName].filter(Boolean).join(" ").trim() ||
    cardFullName ||
    "";
  return {
    fullName,
    passport: src.oneIdPin || "",
    passportSeries: src.passportSeria || null,
    passportNumber:
      src.passportNumber != null ? String(src.passportNumber) : null,
    passportValidUntil: src.passportValidUntil || null,
    passportIssuedBy: src.passportIssuedBy || null,
    mfy: src.mfy || null,
    street: src.street || null,
  };
}

module.exports = {
  addQualPetition: async (req, res, next) => {
    try {
      const id = await resolveOneIdIdentity(req);
      const passport = id.passport;
      if (!passport) {
        return res
          .status(400)
          .json({ message: "OneID identifikatsiyasi topilmadi — ariza yaratib bo'lmaydi" });
      }
      const fullName = id.fullName || "—";

      const existing = await QualPetition.findOne({
        passport,
        course: req.body.course,
        status: { $in: [1, 2] },
      });
      if (existing) {
        return res
          .status(409)
          .json({ message: "Bu kursga allaqachon ariza yuborilgan" });
      }

      const doc = await QualPetition.create({
        fullName,
        passport,
        bachelorDiploma: req.body.bachelorDiploma,
        mastersDiploma: req.body.mastersDiploma || null,
        moCertificate: req.body.moCertificate || null,
        course: req.body.course,
        province: req.body.province,
        region: req.body.region,
        institution: req.body.institution || null,
        phone: req.body.phone || null,
        passportSeries: id.passportSeries,
        passportNumber: id.passportNumber,
        passportValidUntil: id.passportValidUntil,
        passportIssuedBy: id.passportIssuedBy,
        mfy: id.mfy,
        street: id.street,
        status: 1,
      });
      return res.status(201).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to add qualPetition", err.message),
      );
    }
  },

  findMyOneIdProfile: async (req, res, next) => {
    try {
      const { fullName, passport } = await resolveOneIdIdentity(req);
      return res.status(200).json({ fullName, passport });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to get my OneID profile", err.message),
      );
    }
  },

  findMyPetitions: async (req, res, next) => {
    try {
      const passport = await getPassport(req);
      const docs = await QualPetition.find({ passport })
        .select("course status")
        .exec();
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find my qualPetitions", err.message),
      );
    }
  },

  findAllQualPetitions: async (req, res, next) => {
    try {
      const { search, status, course } = req.query;
      const query = { ...(await listenerScope(req, "passport")) };

      if (search) {
        const regex = new RegExp(search, "i");

        query.$or = [{ fullName: regex }, { passport: regex }];
      }
      if (status) query.status = status;
      if (course) query.course = course;

      let docs = await QualPetition.find(query)
        .populate([
          { path: "course", select: "title form startDate endDate status" },
        ])
        .setOptions({ strictPopulate: false })
        .sort({ status: 1, createdAt: 1 })
        .exec();
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find qualPetitions", err.message),
      );
    }
  },

  paginateQualPetitions: async (req, res, next) => {
    try {
      const { page, limit, search, status, course } = req.query;
      const query = { ...(await listenerScope(req, "passport")) };

      if (search) {
        const regex = new RegExp(search, "i");

        query.$or = [{ fullName: regex }, { passport: regex }];
      }
      if (status) query.status = status;
      if (course) query.course = course;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { status: 1, createdAt: 1 },
        lean: true,
        strictPopulate: false,
        populate: [
          {
            path: "course",
            select: "title form startDate endDate status listenersLimit",
          },
        ],
      };
      const doc = await QualPetition.paginate(query, options);

      const courseIds = doc.docs
        .map((d) => (d.course ? d.course._id : null))
        .filter(Boolean);
      const counts = courseIds.length
        ? await QualCourseSubscription.aggregate([
            { $match: { course: { $in: courseIds } } },
            { $group: { _id: "$course", n: { $sum: 1 } } },
          ])
        : [];
      const countMap = new Map(counts.map((c) => [String(c._id), c.n]));

      const missing = doc.docs.filter((d) => d.status === 2 && !d.acceptedAt);
      const byPetition = new Map();
      if (missing.length) {
        const contracts = await QualContract.find({
          petition: { $in: missing.map((d) => d._id) },
        })
          .select("petition createdAt")
          .lean();
        contracts.forEach((c) => byPetition.set(String(c.petition), c.createdAt));
      }

      doc.docs = doc.docs.map((d) => {
        const lim =
          d.course && d.course.listenersLimit ? d.course.listenersLimit : 0;
        const subs = d.course ? countMap.get(String(d.course._id)) || 0 : 0;
        const acceptedAt =
          d.acceptedAt || (d.status === 2 ? byPetition.get(String(d._id)) || null : null);
        return { ...d, acceptedAt, courseFull: lim > 0 && subs >= lim };
      });

      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to paginate qualPetitions", err.message),
      );
    }
  },

  findOneQualPetition: async (req, res, next) => {
    try {
      const scope = await listenerScope(req, "passport");
      const doc = await QualPetition.findOne({ _id: req.params.id, ...scope })
        .populate([
          {
            path: "course",
            select: "title form startDate endDate status listenersLimit",
          },
          { path: "province", select: "title" },
          { path: "region", select: "title" },
        ])
        .setOptions({ strictPopulate: false })
        .lean();

      if (!doc) return res.status(404).json({ message: "not found" });

      const courseId =
        doc.course && doc.course._id ? doc.course._id : doc.course;
      const limit =
        doc.course && doc.course.listenersLimit ? doc.course.listenersLimit : 0;
      const totalSubscribers = await QualCourseSubscription.countDocuments({
        course: courseId,
      });
      doc.listenersLimit = limit;
      doc.totalSubscribers = totalSubscribers;
      doc.courseFull = limit > 0 && totalSubscribers >= limit;

      const listener = await QualListener.findOne({ passport: doc.passport })
        .select("_id")
        .lean();
      if (listener) {
        const sub = await QualCourseSubscription.findOne({
          course: doc.course && doc.course._id ? doc.course._id : doc.course,
          listener: listener._id,
        })
          .select("educationType")
          .lean();
        if (sub) doc.educationType = sub.educationType;
      }

      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find qualPetition", err.message),
      );
    }
  },

  acceptQualPetition: async (req, res, next) => {
    try {
      const petition = await QualPetition.findById(req.params.id);
      if (!petition) return res.status(404).json({ message: "not found" });

      let listener = await QualListener.findOne({ passport: petition.passport });
      const existingSub = listener
        ? await QualCourseSubscription.findOne({
            course: petition.course,
            listener: listener._id,
          })
        : null;

      if (!existingSub) {
        const courseDoc = await QualCourse.findById(petition.course)
          .select("listenersLimit")
          .lean();
        const limit =
          courseDoc && courseDoc.listenersLimit ? courseDoc.listenersLimit : 0;
        const currentCount = await QualCourseSubscription.countDocuments({
          course: petition.course,
        });
        if (limit > 0 && currentCount >= limit) {
          return res.status(409).json({
            message: "Kurs to'la — bo'sh joy qolmagan, tasdiqlab bo'lmaydi",
          });
        }
      }

      if (!listener) {
        listener = await QualListener.create({
          fullName: petition.fullName,
          passport: petition.passport,
        });
      }

      if (!existingSub) {
        await QualCourseSubscription.create({
          course: petition.course,
          listener: listener._id,
          educationType: 2,
        });
      }

      petition.status = 2;
      if (!petition.acceptedAt) petition.acceptedAt = new Date();
      await petition.save();

      let contract = await QualContract.findOne({
        course: petition.course,
        listener: listener._id,
      });
      if (!contract) {
        const course = await QualCourse.findById(petition.course)
          .select("price")
          .lean();
        const price = (course && course.price) || 0;
        const count = await QualContract.countDocuments();
        contract = await QualContract.create({
          course: petition.course,
          listener: listener._id,
          petition: petition._id,
          number: String(count + 1).padStart(4, "0"),
          totalPrice: price,
          debitPrice: price,
        });
        const rel = await saveAndUpdatePdf({
          buildFn: buildContractPdf,
          Model: QualContract,
          id: contract._id,
          prefix: "shartnoma",
        });
        if (rel && rel.startsWith("/")) {
          const base = resolvePublicBaseUrl(req);
          if (base) {
            await QualContract.updateOne(
              { _id: contract._id },
              { $set: { file: `${base}${rel}` } },
            );
          } else {
            winston.warn(
              "[qualPetition] Host ruxsat etilmagan — shartnoma fayli nisbiy holicha qoldi",
            );
          }
        }
      }

      return res.status(200).json(petition);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to accept qualPetition", err.message),
      );
    }
  },

  rejectQualPetition: async (req, res, next) => {
    try {
      const doc = await QualPetition.findByIdAndUpdate(
        req.params.id,
        { status: 3 },
        { new: true },
      );

      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to reject qualPetition", err.message),
      );
    }
  },
};
