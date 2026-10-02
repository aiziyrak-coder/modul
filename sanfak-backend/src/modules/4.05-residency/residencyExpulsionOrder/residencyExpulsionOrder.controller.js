const { pipeline } = require("stream");
const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");
const S = require("./residencyExpulsionOrder.service");

const wrap = (label, fn) => async (req, res, next) => {
  try {
    return await fn(req, res);
  } catch (err) {
    return next(err instanceof ErrorHandler ? err : new ErrorHandler(500, label, err.message));
  }
};

const contentDisposition = (name) => {
  const safe = String(name || "buyruq-skan");
  const ascii = safe.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
};

const setAttachmentHeaders = (res, { size, fileName }) => {
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Length", size);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Content-Disposition", contentDisposition(fileName));
};

module.exports = {
  paginate: wrap("Buyruqlar ro'yxati xatosi", async (req, res) => {
    const page = await S.paginate(req.query, req.user);
    return res.status(200).json(page);
  }),

  findOne: wrap("Buyruqni olishda xato", async (req, res) => {
    const dto = await S.findOne(req.params.id, req.user);
    return res.status(200).json(dto);
  }),

  uploadScan: wrap("Skanni yuklashda xato", async (req, res) => {
    const dto = await S.uploadScan(req.params.id, req.file, req.user);
    return res.status(200).json(dto);
  }),

  sign: wrap("Buyruqni imzolashda xato", async (req, res) => {
    const dto = await S.sign(req.params.id, req.body, req.eri, req.user);
    return res.status(200).json(dto);
  }),

  reject: wrap("Buyruqni rad etishda xato", async (req, res) => {
    const dto = await S.reject(req.params.id, req.body, req.user);
    return res.status(200).json(dto);
  }),

  downloadScan: wrap("Skanni yuklab olishda xato", async (req, res) => {
    const { scan, size } = await S.scanForDownload(req.params.id, req.user);
    setAttachmentHeaders(res, { size, fileName: scan.fileName });
    return pipeline(S.createReadStream(scan.storageKey), res, (err) => {
      if (err && err.code !== "ERR_STREAM_PREMATURE_CLOSE") {
        winston.error(`[4.5] expulsionOrder: skan oqimi uzildi (${req.params.id}): ${err.message}`);
      }
    });
  }),

  downloadDraftPdf: wrap("Loyiha PDF'ini yuklab olishda xato", async (req, res) => {
    const { draftPdf, buffer } = await S.draftPdfForDownload(req.params.id, req.user);
    setAttachmentHeaders(res, { size: buffer.length, fileName: draftPdf.fileName });
    return res.end(buffer);
  }),

  draftPdfHead: (req, res) => res.set("Allow", "GET").status(405).end(),
};
