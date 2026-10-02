const { ErrorHandler } = require("#shared/error");
const Task = require("#modules/4.07-task/task/task.model");
const service = require("./taskCategory.service");

module.exports = {
  addCategory: async (req, res, next) => {
    try {
      const exists = await service.findByName(req.body.name);
      if (exists) {
        return res.status(409).json({ message: "Bu kategoriya allaqachon mavjud" });
      }
      const doc = await service.create(req.body);
      if (!doc) return res.status(400).json({ message: "Saqlanmadi" });
      return res.status(201).json({ message: "Kategoriya yaratildi", data: doc });
    } catch (err) {
      if (err.code === 11000) return next(new ErrorHandler(409, "Bu kategoriya allaqachon mavjud"));
      return next(new ErrorHandler(400, "Kategoriya yaratishda xatolik", err.message));
    }
  },

  findAllCategories: async (req, res, next) => {
    try {
      const filter = service.buildFilter(req.query);
      const docs = await service.findAll(filter);
      return res.status(200).json(docs);
    } catch (err) {
      return next(new ErrorHandler(400, "Kategoriyalarni olishda xatolik", err.message));
    }
  },

  paginateCategories: async (req, res, next) => {
    try {
      const filter = service.buildFilter(req.query);
      const doc = await service.paginate(filter, req.query);
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Kategoriyalarni paginate qilishda xatolik", err.message));
    }
  },

  findOneCategory: async (req, res, next) => {
    try {
      const doc = await service.findOne(req.params.id);
      if (!doc) return res.status(404).json({ message: "Topilmadi" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Kategoriyani olishda xatolik", err.message));
    }
  },

  updateCategory: async (req, res, next) => {
    try {
      if (req.body.name) {
        const exists = await service.findByName(req.body.name);
        if (exists && String(exists._id) !== req.params.id) {
          return res.status(409).json({ message: "Bu nom band" });
        }
      }
      const doc = await service.update(req.params.id, req.body);
      if (!doc) return res.status(404).json({ message: "Topilmadi" });
      return res.status(200).json({ message: "Yangilandi", data: doc });
    } catch (err) {
      if (err.code === 11000) return next(new ErrorHandler(409, "Bu nom band"));
      return next(new ErrorHandler(400, "Kategoriyani yangilashda xatolik", err.message));
    }
  },

  deleteCategory: async (req, res, next) => {
    try {
      const inUse = await Task.countDocuments({ category: req.params.id });
      if (inUse) {
        return res.status(409).json({
          message: `Bu kategoriya ${inUse} ta topshiriqda ishlatilmoqda — o'chirib bo'lmaydi`,
        });
      }
      const doc = await service.remove(req.params.id);
      if (!doc) return res.status(404).json({ message: "Topilmadi" });
      return res.status(200).json({ message: "O'chirildi" });
    } catch (err) {
      return next(new ErrorHandler(400, "Kategoriyani o'chirishda xatolik", err.message));
    }
  },
};
