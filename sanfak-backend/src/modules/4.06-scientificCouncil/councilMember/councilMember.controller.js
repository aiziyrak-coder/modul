const { ErrorHandler } = require("#shared/error");
const service = require("./councilMember.service");
const {
  specialtyIdsOfCouncil,
} = require("#modules/4.06-scientificCouncil/_shared/councilSpecialties");
const {
  safeDispatch,
} = require("#modules/4.06-scientificCouncil/_shared/scienceCouncilNotify");

module.exports = {
  addMember: async (req, res, next) => {
    try {
      const doc = await service.create(req.body);

      if (doc.user) {
        await safeDispatch({
          userId: doc.user,
          eventType: "science_member_added",
          title: "Siz ilmiy kengash a'zoligiga biriktirildingiz",
          link: "/science-council",
          metadata: { memberId: doc._id },
        });
      }

      return res
        .status(201)
        .json({ message: "successfully created", _id: doc._id });
    } catch (err) {
      if (err.code === 11000) {
        return next(
          new ErrorHandler(409, "Bu foydalanuvchi allaqachon a'zo", err.message),
        );
      }
      return next(
        new ErrorHandler(400, "A'zo qo'shishda xatolik", err.message),
      );
    }
  },

  findAllMembers: async (req, res, next) => {
    try {
      const filter = service.buildFilter({
        scope: req.scope,
        search: req.query.search,
        active: req.query.active,
        all: req.query.all === "true",
        specialty: req.query.specialty,
        specialtyIds: req.query.councilNumber
          ? await specialtyIdsOfCouncil(req.query.councilNumber)
          : undefined,
      });
      const docs = await service.findAll(filter);
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "A'zolarni olishda xatolik", err.message),
      );
    }
  },

  paginateMembers: async (req, res, next) => {
    try {
      const filter = service.buildFilter({
        scope: req.scope,
        search: req.query.search,
        active: req.query.active,
        all: req.query.all === "true",
        specialty: req.query.specialty,
        specialtyIds: req.query.councilNumber
          ? await specialtyIdsOfCouncil(req.query.councilNumber)
          : undefined,
      });
      const result = await service.paginate(filter, {
        page: req.query.page,
        limit: req.query.limit,
      });
      return res.status(200).json(result);
    } catch (err) {
      return next(
        new ErrorHandler(400, "A'zolarni sahifalashda xatolik", err.message),
      );
    }
  },

  findOneMember: async (req, res, next) => {
    try {
      const doc = await service.findOne(req.params.id);
      if (!doc)
        return next(new ErrorHandler(404, "A'zo topilmadi"));
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "A'zoni olishda xatolik", err.message),
      );
    }
  },

  updateMember: async (req, res, next) => {
    try {
      const doc = await service.update(req.params.id, req.body);
      if (!doc)
        return next(new ErrorHandler(404, "A'zo topilmadi"));
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "A'zoni yangilashda xatolik", err.message),
      );
    }
  },

  deleteMember: async (req, res, next) => {
    try {
      const doc = await service.remove(req.params.id);
      if (!doc)
        return next(new ErrorHandler(404, "A'zo topilmadi"));

      if (doc.user) {
        await safeDispatch({
          userId: doc.user,
          eventType: "science_member_removed",
          title: "Siz ilmiy kengash a'zoligidan chetlashtirildingiz",
          metadata: { memberId: doc._id },
        });
      }

      return res
        .status(200)
        .json({ message: `successfully deleted ${doc._id}` });
    } catch (err) {
      return next(
        new ErrorHandler(400, "A'zoni o'chirishda xatolik", err.message),
      );
    }
  },
};
