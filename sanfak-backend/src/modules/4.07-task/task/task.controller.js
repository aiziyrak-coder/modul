const path = require("path");
const ExcelJS = require("exceljs");
const { ErrorHandler } = require("#shared/error");
const service = require("./task.service");

const humanSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const buildAttachments = (req) => {
  const files = req.files?.files || [];
  const media = req.body.media || [];
  if (!files.length) return [];
  return files.map((f, i) => ({
    name: f.originalname,
    size: humanSize(f.size),
    type: path.extname(f.originalname).replace(".", "").toLowerCase(),
    url: media[i]?.image || null,
  }));
};

const parseAssignees = (raw) => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [raw];
    } catch {
      return raw.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
};

const toBool = (v) => v === true || v === "true";

const wrapErr = (err, message) =>
  err.statusCode ? err : new ErrorHandler(400, message, err.message);

const buildExcel = (title, rows) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SANFAK AIS";
  const ws = wb.addWorksheet(title, { views: [{ state: "frozen", ySplit: 2 }] });

  if (!rows.length) {
    ws.addRow([title]);
    ws.addRow(["Ma'lumot topilmadi"]);
    return wb;
  }

  const keys = Object.keys(rows[0]);
  ws.mergeCells(1, 1, 1, keys.length);
  ws.getRow(1).getCell(1).value = title;
  ws.getRow(1).getCell(1).font = { bold: true, size: 13 };
  ws.getRow(1).getCell(1).alignment = { horizontal: "center" };

  const header = ws.addRow(keys);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF12B76A" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  ws.columns = keys.map((k) => ({ key: k, width: Math.max(k.length + 4, 12) }));
  rows.forEach((row) => ws.addRow(Object.values(row)));
  return wb;
};

module.exports = {
  addTask: async (req, res, next) => {
    try {
      const assignees = parseAssignees(req.body.assignees);
      if (!assignees.length) {
        return next(new ErrorHandler(400, "Kamida bitta ijrochi tanlang"));
      }

      if (req.body.deadline) {
        const d = new Date(req.body.deadline);
        const startToday = new Date();
        startToday.setHours(0, 0, 0, 0);
        if (d < startToday) {
          return next(new ErrorHandler(400, "Muddat o'tmishdan bo'lishi mumkin emas"));
        }
      }

      const items = await service.create(
        {
          title: req.body.title,
          description: req.body.description || null,
          deadline: req.body.deadline,
          priority: req.body.priority,
          category: req.body.category || null,
          attachments: buildAttachments(req),
          assignees,
        },
        req.user,
      );

      return res.status(201).json({
        message: "Topshiriq(lar) yaratildi",
        count: items.length,
        data: items,
      });
    } catch (err) {
      return next(wrapErr(err, "Topshiriq yaratishda xatolik"));
    }
  },

  findAllTasks: async (req, res, next) => {
    try {
      const docs = await service.findAll(req.user, req.query);
      return res.status(200).json(docs);
    } catch (err) {
      return next(wrapErr(err, "Topshiriqlarni olishda xatolik"));
    }
  },

  paginateTasks: async (req, res, next) => {
    try {
      const doc = await service.paginate(req.user, req.query);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Topshiriqlarni paginate qilishda xatolik"));
    }
  },

  getMyTasks: async (req, res, next) => {
    try {
      const docs = await service.findMine(req.user, req.query);
      return res.status(200).json(docs);
    } catch (err) {
      return next(wrapErr(err, "Mening topshiriqlarimni olishda xatolik"));
    }
  },

  paginateMyTasks: async (req, res, next) => {
    try {
      const doc = await service.paginateMine(req.user, req.query);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Mening topshiriqlarimni paginate qilishda xatolik"));
    }
  },

  taskStats: async (req, res, next) => {
    try {
      const data = await service.stats(req.user, req.query);
      return res.status(200).json(data);
    } catch (err) {
      return next(wrapErr(err, "Statistikani olishda xatolik"));
    }
  },

  getAssignableUsers: async (req, res, next) => {
    try {
      const users = await service.assignableUsers(req.user, req.query);
      return res.status(200).json(users);
    } catch (err) {
      return next(wrapErr(err, "Biriktiriladigan xodimlarni olishda xatolik"));
    }
  },

  findOneTask: async (req, res, next) => {
    try {
      const doc = await service.findOne(req.params.id, req.user);
      if (!doc) return res.status(404).json({ message: "Topilmadi" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Topshiriqni olishda xatolik"));
    }
  },

  updateTask: async (req, res, next) => {
    try {
      const body = { ...req.body };
      const attachments = buildAttachments(req);
      if (attachments.length) body.attachments = attachments;
      if (body.category === "") body.category = null;
      delete body.media;
      const doc = await service.update(req.params.id, req.user, body);
      return res.status(200).json({ message: "Yangilandi", data: doc });
    } catch (err) {
      return next(wrapErr(err, "Topshiriqni yangilashda xatolik"));
    }
  },

  deleteTask: async (req, res, next) => {
    try {
      await service.remove(req.params.id, req.user, req.body?.reason);
      return res.status(200).json({ message: "Topshiriq arxivlandi" });
    } catch (err) {
      return next(wrapErr(err, "Topshiriqni o'chirishda xatolik"));
    }
  },

  addResponse: async (req, res, next) => {
    try {
      const result = await service.addResponse(req.params.id, req.user, {
        text: req.body.text,
        attachments: buildAttachments(req),
        isCompleted: toBool(req.body.isCompleted),
        isRejected: toBool(req.body.isRejected),
        rejectionReason: req.body.rejectionReason,
        isDeadlineChange: toBool(req.body.isDeadlineChange),
        isReassign: toBool(req.body.isReassign),
      });
      return res.status(201).json({ message: "Javob qo'shildi", data: result });
    } catch (err) {
      return next(wrapErr(err, "Javob qo'shishda xatolik"));
    }
  },

  listResponses: async (req, res, next) => {
    try {
      const doc = await service.listResponses(req.params.id, req.user, req.query);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Yozishmalarni olishda xatolik"));
    }
  },

  finalizeTask: async (req, res, next) => {
    try {
      const doc = await service.finalize(req.params.id, req.user, req.body.outcome);
      return res.status(200).json({ message: "Topshiriq yakunlandi", data: doc });
    } catch (err) {
      return next(wrapErr(err, "Topshiriqni yakunlashda xatolik"));
    }
  },

  reopenTask: async (req, res, next) => {
    try {
      const doc = await service.reopen(req.params.id, req.user);
      return res.status(200).json({ message: "Topshiriq qayta ochildi", data: doc });
    } catch (err) {
      return next(wrapErr(err, "Topshiriqni qayta ochishda xatolik"));
    }
  },

  monitoring: async (req, res, next) => {
    try {
      const doc = await service.monitoringPage(req.user, req.query);
      return res.status(200).json(doc);
    } catch (err) {
      return next(wrapErr(err, "Monitoringda xatolik"));
    }
  },

  monitoringMonthly: async (req, res, next) => {
    try {
      const data = await service.monitoringMonthly(req.user, req.query);
      return res.status(200).json({ data });
    } catch (err) {
      return next(wrapErr(err, "Oylik dinamikada xatolik"));
    }
  },

  monitoringExport: async (req, res, next) => {
    try {
      const rows = await service.monitoringRows(req.user, req.query);
      const data = rows.map((r, i) => ({
        "№": i + 1,
        "F.I.O":
          [r.lastName, r.firstName, r.middleName].filter(Boolean).join(" ") || "—",
        Lavozim: r.position || "—",
        Kafedra: r.department || "—",
        Jami: r.total,
        Bajarildi: r.completed,
        Faol: r.active,
        Kechikkan: r.overdue,
        "Rad etildi": r.rejected,
        "Reyting (%)": r.rating,
      }));
      const wb = buildExcel("Topshiriqlar monitoringi", data);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="task-monitoring.xlsx"',
      );
      await wb.xlsx.write(res);
      return res.end();
    } catch (err) {
      return next(wrapErr(err, "Monitoringni eksport qilishda xatolik"));
    }
  },
};
