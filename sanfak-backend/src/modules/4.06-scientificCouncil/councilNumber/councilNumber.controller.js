const { ErrorHandler } = require("#shared/error");
const service = require("./councilNumber.service");
const CouncilSpecialty = require("../councilSpecialty/councilSpecialty.model");
const { PAGINATION } = require("#config/constants");
const { parseBool, isTrue } = require("../_shared/queryFlags");

const wrapErr = (err, fallback) =>
  err instanceof ErrorHandler ? err : new ErrorHandler(400, fallback, err.message);


const assertSpecialtiesExist = async (ids) => {
  if (!Array.isArray(ids) || ids.length === 0) return;
  const unique = [...new Set(ids.map(String))];
  const found = await CouncilSpecialty.countDocuments({ _id: { $in: unique } });
  if (found !== unique.length) {
    throw new ErrorHandler(400, "Biriktirilgan ixtisosliklardan ba'zisi topilmadi");
  }
};

const assertNoActiveConflict = async (specialtyIds, exceptId) => {
  if (!Array.isArray(specialtyIds) || specialtyIds.length === 0) return;
  const wanted = new Set(specialtyIds.map(String));
  const clashes = await service.findActiveConflicts([...wanted], exceptId);
  if (clashes.length === 0) return;

  const details = clashes
    .map((c) => {
      const codes = (c.specialties || [])
        .filter((sp) => wanted.has(String(sp._id)))
        .map((sp) => sp.code)
        .join(", ");
      return `${codes} → ${c.number}`;
    })
    .join("; ");
  throw new ErrorHandler(
    409,
    `Bu ixtisoslik(lar) allaqachon faol kengash raqamiga biriktirilgan: ${details}`,
  );
};

module.exports = {
  addNumber: async (req, res, next) => {
    try {
      await assertSpecialtiesExist(req.body.specialties);
      if (req.body.active !== false) {
        await assertNoActiveConflict(req.body.specialties, null);
      }
      const doc = await service.create(req.body);
      return res
        .status(201)
        .json({ message: "successfully created", _id: doc._id });
    } catch (err) {
      if (err.code === 11000) {
        return next(
          new ErrorHandler(409, "Bu ilmiy kengash raqami allaqachon mavjud", err.message),
        );
      }
      return next(wrapErr(err, "Ilmiy kengash raqamini qo'shishda xatolik"));
    }
  },

  findAllNumbers: async (req, res, next) => {
    try {
      const filter = service.buildFilter({
        search: req.query.search,
        active: parseBool(req.query.active),
        all: isTrue(req.query.all),
      });
      const docs = await service.findAll(filter);
      return res.status(200).json(docs);
    } catch (err) {
      return next(wrapErr(err, "Ilmiy kengash raqamlarini olishda xatolik"));
    }
  },

  paginateNumbers: async (req, res, next) => {
    try {
      const filter = service.buildFilter({
        search: req.query.search,
        active: parseBool(req.query.active),
        all: isTrue(req.query.all),
      });
      const docs = await service.paginate(filter, {
        page: req.query.page || PAGINATION.DEFAULT_PAGE,
        limit: req.query.limit || PAGINATION.DEFAULT_LIMIT,
      });
      return res.status(200).json(docs);
    } catch (err) {
      return next(wrapErr(err, "Ilmiy kengash raqamlarini olishda xatolik"));
    }
  },

  findOneNumber: async (req, res, next) => {
    try {
      const doc = await service.findOne(req.params.id);
      if (!doc) return next(new ErrorHandler(404, "Ilmiy kengash raqami topilmadi"));
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Ilmiy kengash raqamini olishda xatolik"));
    }
  },

  updateNumber: async (req, res, next) => {
    try {
      await assertSpecialtiesExist(req.body.specialties);

      const current = await service.findOne(req.params.id);
      if (!current) return next(new ErrorHandler(404, "Ilmiy kengash raqami topilmadi"));

      const nextActive =
        req.body.active === undefined ? current.active : req.body.active;
      const nextSpecialties =
        req.body.specialties === undefined
          ? (current.specialties || []).map((sp) => String(sp._id))
          : req.body.specialties;

      if (nextActive) {
        await assertNoActiveConflict(nextSpecialties, req.params.id);
      }

      const doc = await service.update(req.params.id, req.body);
      if (!doc) return next(new ErrorHandler(404, "Ilmiy kengash raqami topilmadi"));
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      if (err.code === 11000) {
        return next(
          new ErrorHandler(409, "Bu ilmiy kengash raqami allaqachon mavjud", err.message),
        );
      }
      return next(wrapErr(err, "Ilmiy kengash raqamini yangilashda xatolik"));
    }
  },

  deleteNumber: async (req, res, next) => {
    try {
      const doc = await service.remove(req.params.id);
      if (!doc) return next(new ErrorHandler(404, "Ilmiy kengash raqami topilmadi"));
      return res.status(200).json({ message: "successfully deleted" });
    } catch (err) {
      return next(wrapErr(err, "Ilmiy kengash raqamini o'chirishda xatolik"));
    }
  },
};
