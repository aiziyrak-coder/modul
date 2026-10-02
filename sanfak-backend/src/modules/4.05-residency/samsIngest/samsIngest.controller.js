"use strict";

const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");

let service = null;

function loadService() {
  if (service) return service;
  try {
    service = require("./samsIngest.service");
    return service;
  } catch (err) {
    winston.error(`[residency-sams] servis yuklanmadi: ${err.message}`);
    throw new ErrorHandler(503, "SAMS integratsiyasi vaqtincha ishlamayapti", "", {
      reason: "sams_ingest_unavailable",
    });
  }
}

const wrap = (label, fn) => async (req, res, next) => {
  try {
    return res.status(200).json(await fn(req));
  } catch (err) {
    return next(err instanceof ErrorHandler ? err : new ErrorHandler(500, label, err.message));
  }
};

module.exports = {
  roster: wrap("SAMS rosterini tayyorlashda xatolik", () =>
    loadService().getRoster(new Date()),
  ),
  ingest: wrap("SAMS paketini qabul qilishda xatolik", (req) =>
    loadService().ingestPacket(req.body, new Date(), () => new Date()),
  ),
};
