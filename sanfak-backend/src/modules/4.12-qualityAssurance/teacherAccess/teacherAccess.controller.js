const { ErrorHandler } = require("#shared/error");
const service = require("./teacherAccess.service");

module.exports = {
  findOneAccess: async (req, res, next) => {
    try {
      return res.status(200).json(await service.findByTeacher(req.params.teacher));
    } catch (err) {
      return next(new ErrorHandler(400, "Huquqni olishda xato", err.message));
    }
  },

  findAllAccess: async (req, res, next) => {
    try {
      return res.status(200).json(await service.listWritten());
    } catch (err) {
      return next(new ErrorHandler(400, "Huquqlarni olishda xato", err.message));
    }
  },

  setAccess: async (req, res, next) => {
    try {
      return res.status(200).json(await service.set(req.params.teacher, req.body));
    } catch (err) {
      return next(new ErrorHandler(400, "Huquqni saqlashda xato", err.message));
    }
  },
};
