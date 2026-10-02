"use strict";

const { ErrorHandler } = require("#shared/error");
const {
  resolveAcademicYearId,
} = require("#references/_services/academicYearResolver");
const service = require("./departmentContingent.service");
const { buildSummary } = require("./departmentContingent.summary");

const wrapErr = (err, message) =>
  err.statusCode ? err : new ErrorHandler(400, message, err.message);

function yearOrThrow(value) {
  const id = resolveAcademicYearId(value);
  if (!id) throw new ErrorHandler(400, "O'quv yili topilmadi");
  return id;
}

class DepartmentContingentController {
  async addContingent(req, res, next) {
    try {
      const doc = await service.createContingent({
        scope: req.scope,
        academicYear: yearOrThrow(req.body.academicYear),
        userId: req.user._id,
      });
      return res.status(201).json({ message: "Kafedra kontingenti yaratildi", data: doc });
    } catch (err) {
      return next(wrapErr(err, "Kafedra kontingentini yaratishda xatolik"));
    }
  }

  async paginateContingents(req, res, next) {
    try {
      const query = { ...req.query };
      if (query.academicYear) query.academicYear = yearOrThrow(query.academicYear);
      const result = await service.paginateContingents({ scope: req.scope, query });
      return res.status(200).json(result);
    } catch (err) {
      return next(wrapErr(err, "Kafedra kontingentlari ro'yxatini olishda xatolik"));
    }
  }

  async summary(req, res, next) {
    try {
      const data = await buildSummary({ academicYear: yearOrThrow(req.query.academicYear) });
      return res.status(200).json({ data });
    } catch (err) {
      return next(wrapErr(err, "Kontingent yig'masini olishda xatolik"));
    }
  }

  async prefill(req, res, next) {
    try {
      const data = await service.prefillRow({
        academicYear: yearOrThrow(req.query.academicYear),
        direction: req.query.direction,
        courseNum: req.query.courseNum,
      });
      return res.status(200).json({ data });
    } catch (err) {
      return next(wrapErr(err, "Taklif tuzishda xatolik"));
    }
  }

  async getContingent(req, res, next) {
    try {
      const data = await service.findContingent({ id: req.params.id, scope: req.scope });
      return res.status(200).json({ data });
    } catch (err) {
      return next(wrapErr(err, "Kafedra kontingentini olishda xatolik"));
    }
  }

  async updateContingent(req, res, next) {
    try {
      const { flaggedWorkloads } = await service.updateContingent({
        id: req.params.id,
        scope: req.scope,
        rows: req.body.rows,
        userId: req.user._id,
      });
      const data = await service.findContingent({ id: req.params.id, scope: req.scope });
      return res.status(200).json({ message: "Kafedra kontingenti saqlandi", data, meta: { flaggedWorkloads } });
    } catch (err) {
      return next(wrapErr(err, "Kafedra kontingentini saqlashda xatolik"));
    }
  }

  async deleteContingent(req, res, next) {
    try {
      const meta = await service.removeContingent({
        id: req.params.id,
        scope: req.scope,
        userId: req.user._id,
      });
      return res.status(200).json({ message: "Kafedra kontingenti o'chirildi", meta });
    } catch (err) {
      return next(wrapErr(err, "Kafedra kontingentini o'chirishda xatolik"));
    }
  }
}

module.exports = new DepartmentContingentController();
