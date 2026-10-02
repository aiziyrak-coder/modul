"use strict";

const { ErrorHandler } = require("#shared/error");
const { buildResidentScope } = require("#modules/4.05-residency/_services/residentScope");
const S = require("./samsStatus.service");

const wrap = (label, fn) => async (req, res, next) => {
  try {
    return res.status(200).json(await fn(req));
  } catch (err) {
    return next(err instanceof ErrorHandler ? err : new ErrorHandler(500, label, err.message));
  }
};

async function residentBaseline(req) {
  const { resident } = req.params;
  const { denied } = await buildResidentScope(req.user, resident);
  if (denied) {
    throw new ErrorHandler(403, "Bu rezident sizning doirangizda emas", "", { reason: "resident_out_of_scope" });
  }
  if (!(await S.residentExists(resident))) {
    throw new ErrorHandler(404, "Rezident topilmadi", "", { reason: "resident_not_found" });
  }
  return S.residentBaseline(resident, req.query, new Date());
}

module.exports = {
  overview: wrap("SAMS holatini o'qishda xatolik", () => S.overview(new Date())),
  days: wrap("SAMS kunlarini o'qishda xatolik", (req) => S.days(req.query, new Date())),
  warnings: wrap("SAMS ogohlantirishlarini o'qishda xatolik", (req) => S.warnings(req.query, new Date())),
  clinicDay: wrap("Klinika kunini o'qishda xatolik", (req) => S.clinicDay(req.params, req.query, new Date())),
  residentBaseline: wrap("Rezident bazaviy chizig'ini o'qishda xatolik", residentBaseline),
};
