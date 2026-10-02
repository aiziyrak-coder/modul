const fs = require("fs");
const path = require("path");
const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");
const TeacherLeave = require("./teacherLeave.model");
const { narrowTeacherFilter } = require("./teacherLeave.scope");
const {
  buildBayonnomaInfoRows,
  buildBayonnomaSignature,
  teacherFullName,
} = require("./teacherLeave.bayonnoma");
const { issueToken } = require("#modules/4.02-studyLoad/_verify/documentVerify.service");
const { prepareVerifyQr } = require("#modules/4.02-studyLoad/_shared/verifyQr");
const {
  drawSignatureBlock,
  measureSignatureBlock,
} = require("#modules/4.02-studyLoad/_shared/signatureBlock");
const WorkloadDistribution = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const {
  suggestReplacementTeachers,
  reassignVacancy,
} = require("#modules/4.02-studyLoad/_services/vacancyReassignmentEngine");
const { dispatch } = require("#system/notification/notificationDispatcher");
const {
  safeDispatch,
  safeDispatchMany,
  getDepartmentHeadUserIds,
} = require("#modules/4.02-studyLoad/_shared/chainNotify");
const User = require("#modules/4.01-auth/user/user.model");
const {
  createDoc,
  pipeToResponse,
  drawHeader,
  drawTitle,
  drawSectionTitle,
  drawInfoCard,
  drawTable,
  drawFooter,
  ensureSpace,
  COLORS,
  PAGE,
  CONTENT_WIDTH,
} = require("#shared/pdfGenerators/pdfHelpers");

function findActiveTeacherEntry(dist, teacherId) {
  return (dist.teachers || []).find(
    (t) => !t.isVacant && String(t.teacher || "") === String(teacherId || ""),
  );
}

function findLeaveVacatedEntry(dist, teacherId) {
  return (dist.teachers || []).find(
    (t) =>
      t.isVacant &&
      t.vacancyReason === "leave" &&
      String(t.teacher || "") === String(teacherId || ""),
  );
}

const takesOverLeaveVacancy = (leave, entry) =>
  leave.type !== "leave" &&
  Boolean(entry?.isVacant) &&
  entry.vacancyReason === "leave" &&
  String(entry.teacher || "") === String(leave.teacher || "");

const LEAVE_VACANCY_TAKEN_NOTE =
  "Yozuv avvalroq ta'til bilan vakant qilingan edi — vakant sababi yangilandi " +
  "(qoldiq o'zgarmadi).";

function vacateEntry(dist, entry, leaveType) {
  dist.residueHour = (dist.residueHour || 0) + (entry.totalHour || 0);
  entry.isVacant = true;
  entry.vacantSince = new Date();
  entry.vacancyReason = leaveType;
}

const LEAVES_LINK = "/study-load/teacher-leaves";

const LEAVE_TYPE_LABEL = {
  resignation: "Ishdan bo'shash",
  transfer: "Ko'chirish",
  leave: "Ta'til/chetlatish",
};

const leaveHeadUserIds = async (teacherId) => {
  try {
    if (!teacherId) return [];
    const teacher = await User.findById(teacherId).select("department").lean();
    return await getDepartmentHeadUserIds(teacher?.department);
  } catch (err) {
    winston.warn(
      `[TeacherLeave] kafedra mudirini aniqlashda xato: ${err.message}`,
    );
    return [];
  }
};

module.exports = {
  addTeacherLeave: async (req, res, next) => {
    try {
      if (req.body.type === "leave") {
        const overlap = await TeacherLeave.exists({
          teacher: req.body.teacher || req.user?._id,
          type: "leave",
          status: { $in: ["pending", "approved"] },
          active: { $ne: false },
          fromDate: { $lte: req.body.toDate },
          toDate: { $gte: req.body.fromDate },
        });
        if (overlap) {
          return next(
            new ErrorHandler(
              409,
              "Bu sanalarga to'g'ri keladigan ta'til arizasi allaqachon mavjud (kutilmoqda yoki tasdiqlangan)",
            ),
          );
        }
      }
      const doc = await new TeacherLeave({
        ...req.body,
        teacher: req.body.teacher || req.user?._id,
        status: "pending",
      }).save();

      await safeDispatchMany(await leaveHeadUserIds(doc.teacher), {
        eventType: "teacherLeave_submitted",
        title: "Yangi ariza: tasdiqlashingiz kutilmoqda",
        body:
          `Ariza turi: ${LEAVE_TYPE_LABEL[doc.type] || doc.type}.` +
          (doc.reason ? ` Sabab: ${doc.reason}` : ""),
        link: LEAVES_LINK,
        metadata: { leaveId: doc._id },
      });

      return res.status(201).json({
        message: "Ariza yuborildi",
        _id: doc._id,
        status: doc.status,
      });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Ariza yaratishda xatolik", err.message),
      );
    }
  },

  findAllTeacherLeaves: async (req, res, next) => {
    try {
      const { teacher, type, status } = req.query;
      const filter = { active: true, ...narrowTeacherFilter(req.scope, teacher) };
      if (type) filter.type = type;
      if (status) filter.status = status;

      const docs = await TeacherLeave.find(filter, {
        createdAt: 0,
        updatedAt: 0,
      })
        .populate("teacher", "firstName lastName middleName")
        .populate("approvedBy", "firstName lastName")
        .exec();

      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Arizalar ro'yxatida xatolik", err.message),
      );
    }
  },

  paginateTeacherLeaves: async (req, res, next) => {
    try {
      const { teacher, type, status, page = 1, limit = 20 } = req.query;
      const filter = { active: true, ...narrowTeacherFilter(req.scope, teacher) };
      if (type) filter.type = type;
      if (status) filter.status = status;

      const doc = await TeacherLeave.paginate(filter, {
        page: parseInt(page),
        limit: parseInt(limit),
        populate: [
          { path: "teacher", select: "firstName lastName" },
          { path: "approvedBy", select: "firstName lastName" },
        ],
        lean: true,
      });

      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Sahifalashda xatolik", err.message));
    }
  },

  findOneTeacherLeave: async (req, res, next) => {
    try {
      const doc = await TeacherLeave.findOne(
        { _id: req.params.id, ...req.scope },
        { createdAt: 0, updatedAt: 0 },
      )
        .populate("teacher", "firstName lastName middleName")
        .populate("approvedBy", "firstName lastName")
        .populate("distribution", "title academicYear")
        .exec();

      if (!doc) return res.status(404).json({ message: "Topilmadi" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Arizani olishda xatolik", err.message),
      );
    }
  },

  deleteTeacherLeave: async (req, res, next) => {
    try {
      const doc = await TeacherLeave.findOne(
        { _id: req.params.id, ...req.scope },
        { status: 1 },
      );
      if (!doc) return res.status(404).json({ message: "Topilmadi" });
      if (doc.status !== "pending") {
        return res
          .status(400)
          .json({ message: "Faqat 'pending' arizani o'chirish mumkin" });
      }
      await TeacherLeave.findByIdAndDelete(doc._id);
      return res
        .status(200)
        .json({ message: "Ariza o'chirildi", _id: doc._id });
    } catch (err) {
      return next(new ErrorHandler(400, "O'chirishda xatolik", err.message));
    }
  },

  approveTeacherLeave: async (req, res, next) => {
    try {
      const { comment, distribution: bodyDistribution } = req.body;

      const leave = await TeacherLeave.findOne({
        _id: req.params.id,
        ...req.scope,
      });
      if (!leave) return res.status(404).json({ message: "Topilmadi" });

      if (leave.status !== "pending") {
        return res.status(400).json({
          message: `Faqat 'pending' arizani tasdiqlash mumkin. Joriy: ${leave.status}`,
        });
      }

      let vacancyCreated = false;
      let vacancyNote = null;

      const explicitDistId = bodyDistribution || leave.distribution;

      if (explicitDistId) {
        const dist = await WorkloadDistribution.findById(explicitDistId);
        if (!dist) {
          return next(
            new ErrorHandler(400, "Ko'rsatilgan taqsimot topilmadi"),
          );
        }

        const entry = leave.teacherEntryId
          ? dist.teachers.id(leave.teacherEntryId)
          : findActiveTeacherEntry(dist, leave.teacher) ||
            findLeaveVacatedEntry(dist, leave.teacher);

        if (!entry) {
          return next(
            new ErrorHandler(
              400,
              "Taqsimotda bu o'qituvchining faol yozuvi topilmadi (allaqachon vakantmi?)",
            ),
          );
        }
        const takesOver = takesOverLeaveVacancy(leave, entry);
        if (entry.isVacant && !takesOver) {
          return next(new ErrorHandler(400, "Bu yozuv allaqachon vakant"));
        }

        if (takesOver) {
          entry.vacancyReason = leave.type;
          vacancyNote = LEAVE_VACANCY_TAKEN_NOTE;
        } else {
          vacateEntry(dist, entry, leave.type);
          vacancyCreated = true;
        }
        await dist.save();

        leave.distribution = dist._id;
        leave.teacherEntryId = entry._id;
      } else {
        const candidates = await WorkloadDistribution.find({
          "teachers.teacher": leave.teacher,
          active: true,
        }).select("_id title course academicYear teachers");

        const matches = candidates.filter((d) =>
          Boolean(findActiveTeacherEntry(d, leave.teacher)),
        );
        const leaveVacated =
          matches.length === 0 && leave.type !== "leave"
            ? candidates.filter((d) =>
                Boolean(findLeaveVacatedEntry(d, leave.teacher)),
              )
            : [];

        if (leaveVacated.length === 1) {
          const dist = leaveVacated[0];
          const entry = findLeaveVacatedEntry(dist, leave.teacher);
          entry.vacancyReason = leave.type;
          await dist.save();
          leave.distribution = dist._id;
          leave.teacherEntryId = entry._id;
          vacancyNote = LEAVE_VACANCY_TAKEN_NOTE;
        } else if (matches.length === 0) {
          if (leave.type === "leave") {
            vacancyNote =
              "O'qituvchida faol yuklama taqsimoti topilmadi — vakant yaratilmadi. " +
              "Kerak bo'lsa, arizada taqsimotni ko'rsating.";
          } else {
            return next(
              new ErrorHandler(
                400,
                "Bu o'qituvchida vakantga o'tkaziladigan faol yuklama topilmadi — arizada taqsimotni ko'rsating",
              ),
            );
          }
        } else if (matches.length > 1) {
          return next(
            new ErrorHandler(
              409,
              "O'qituvchida bir nechta faol taqsimot bor — qaysi biri vakantga o'tishini tanlang",
              matches.map((d) => ({
                _id: d._id,
                title: d.title,
                course: d.course,
                academicYear: d.academicYear,
              })),
            ),
          );
        } else {
          const dist = matches[0];
          const entry = findActiveTeacherEntry(dist, leave.teacher);

          vacateEntry(dist, entry, leave.type);
          await dist.save();

          leave.distribution = dist._id;
          leave.teacherEntryId = entry._id;
          vacancyCreated = true;
        }
      }

      leave.status = "approved";
      leave.approvedBy = req.user?._id || null;
      leave.approvalDate = new Date();
      leave.approvalComment = comment || null;
      try {
        await issueToken(leave, req.user?._id || null);
      } catch (err) {
        winston.error(`[TeacherLeave] QR token yaratishda xato: ${err.message}`);
      }
      await leave.save();

      await safeDispatch({
        userId: leave.teacher,
        eventType: "teacherLeave_approved",
        title: "Arizangiz tasdiqlandi",
        body:
          `Ariza turi: ${LEAVE_TYPE_LABEL[leave.type] || leave.type}.` +
          (vacancyCreated
            ? " Taqsimotdagi yuklamangiz vakantga o'tkazildi."
            : "") +
          (comment ? ` Izoh: ${comment}` : ""),
        link: LEAVES_LINK,
        metadata: { leaveId: leave._id },
      });

      const response = {
        message: "Ariza tasdiqlandi",
        status: leave.status,
        vacancyCreated,
      };
      if (vacancyNote) response.vacancyNote = vacancyNote;
      return res.status(200).json(response);
    } catch (err) {
      return next(new ErrorHandler(400, "Tasdiqlashda xatolik", err.message));
    }
  },

  generateBayonnoma: async (req, res, next) => {
    try {
      const leave = await TeacherLeave.findOne({
        _id: req.params.id,
        ...req.scope,
      })
        .populate({
          path: "teacher",
          select: "firstName lastName middleName position department",
          populate: [
            { path: "position", select: "title" },
            { path: "department", select: "title" },
          ],
        })
        .populate({
          path: "approvedBy",
          select: "firstName lastName middleName position",
          populate: { path: "position", select: "title" },
        })
        .populate({
          path: "distribution",
          select: "title academicYear department",
          populate: [
            { path: "department", select: "title" },
            { path: "academicYear", select: "title" },
          ],
        });
      if (!leave) return res.status(404).json({ message: "Topilmadi" });
      if (leave.status !== "approved") {
        return res
          .status(400)
          .json({ message: "Bayonnoma faqat tasdiqlangan arizalar uchun" });
      }

      const doc = createDoc();

      drawHeader(doc);
      drawTitle(
        doc,
        "BAYONNOMA",
        "O'qituvchi yuklamasini vakantsiyaga o'tkazish to'g'risida",
      );

      const teacherName = teacherFullName(leave.teacher);
      drawInfoCard(doc, buildBayonnomaInfoRows(leave));

      ensureSpace(doc, 60);
      drawSectionTitle(doc, "Qaror");
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(COLORS.text)
        .text(
          `${teacherName} o'qituvchining yuklamasi vakantsiya sifatida belgilandi va ` +
            `kafedra bo'yicha yuklama qayta taqsimlanishi lozim.`,
          PAGE.margin,
          doc.y,
          { width: CONTENT_WIDTH, align: "justify" },
        )
        .moveDown(2);

      const qr = await prepareVerifyQr(leave, { docType: "teacherLeave" });
      const sigOpts = { ...buildBayonnomaSignature(leave, qr), x: PAGE.margin, w: CONTENT_WIDTH };
      ensureSpace(doc, measureSignatureBlock(doc, sigOpts) + 10);
      drawSignatureBlock(doc, { ...sigOpts, y: doc.y + 10 });

      drawFooter(doc, "Bayonnoma", "approved");
      doc.flushPages();

      const filename = `bayonnoma-${req.params.id}`;
      pipeToResponse(res, doc, filename);
      doc.end();
    } catch (err) {
      return next(new ErrorHandler(400, "Bayonnoma PDF xatolik", err.message));
    }
  },

  getReassignmentSuggestions: async (req, res, next) => {
    try {
      const leave = await TeacherLeave.findOne({
        _id: req.params.id,
        ...req.scope,
      });
      if (!leave) return res.status(404).json({ message: "Topilmadi" });
      if (leave.status !== "approved") {
        return next(
          new ErrorHandler(400, "Faqat tasdiqlangan ariza uchun tavsiya beriladi"),
        );
      }
      if (!leave.distribution || !leave.teacherEntryId) {
        return next(new ErrorHandler(400, "Vakant ma'lumotlari yo'q"));
      }

      const limit = parseInt(req.query.limit) || 5;
      const suggestions = await suggestReplacementTeachers(
        leave.distribution,
        leave.teacherEntryId,
        limit,
      );

      return res.status(200).json({
        leaveId: leave._id,
        suggestions,
      });
    } catch (err) {
      return next(new ErrorHandler(400, "Tavsiyalarda xato", err.message));
    }
  },

  reassignVacancy: async (req, res, next) => {
    try {
      const { newTeacherId } = req.body;
      if (!newTeacherId) {
        return next(new ErrorHandler(400, "newTeacherId majburiy"));
      }

      const leave = await TeacherLeave.findOne({
        _id: req.params.id,
        ...req.scope,
      });
      if (!leave) return res.status(404).json({ message: "Topilmadi" });
      if (leave.status !== "approved") {
        return next(
          new ErrorHandler(400, "Faqat tasdiqlangan ariza uchun reassign mumkin"),
        );
      }

      const result = await reassignVacancy({
        distributionId: leave.distribution,
        vacantEntryId: leave.teacherEntryId,
        newTeacherId,
        actorUserId: req.user?._id,
      });

      try {
        await dispatch({
          userId: newTeacherId,
          eventType: "vacancy_reassigned",
          title: "Sizga yangi yuklama biriktirildi",
          body:
            `Vakant fan(lar) sizga biriktirildi.\n` +
            `Soat: ${result.entry.totalHour}\n` +
            `Tasdiqlash uchun shaxsiy kabinetga kiring.`,
          link: `/distributions/${leave.distribution}`,
          metadata: {
            distributionId: leave.distribution,
            entryId: leave.teacherEntryId,
            previousTeacher: result.entry.reassignedFrom,
          },
        });
      } catch (notifErr) {
        winston.error(
          `[TeacherLeave] vacancy_reassigned notification xato: ${notifErr.message}`,
        );
      }

      return res.status(200).json({
        message: "Yuklama qaytadan biriktirildi",
        distribution: result.distribution._id,
        entry: result.entry,
      });
    } catch (err) {
      return next(new ErrorHandler(400, "Reassignment xato", err.message));
    }
  },

  rejectTeacherLeave: async (req, res, next) => {
    try {
      const { comment } = req.body;
      if (!comment)
        return res.status(400).json({ message: "comment majburiy" });

      const leave = await TeacherLeave.findOne({
        _id: req.params.id,
        ...req.scope,
      });
      if (!leave) return res.status(404).json({ message: "Topilmadi" });

      if (leave.status !== "pending") {
        return res.status(400).json({
          message: `Faqat 'pending' arizani rad etish mumkin. Joriy: ${leave.status}`,
        });
      }

      leave.status = "rejected";
      leave.approvedBy = req.user?._id || null;
      leave.approvalDate = new Date();
      leave.approvalComment = comment;
      await leave.save();

      await safeDispatch({
        userId: leave.teacher,
        eventType: "teacherLeave_rejected",
        title: "Arizangiz rad etildi",
        body: `Sabab: ${comment}`,
        link: LEAVES_LINK,
        metadata: { leaveId: leave._id },
      });

      return res
        .status(200)
        .json({ message: "Ariza rad etildi", status: leave.status });
    } catch (err) {
      return next(new ErrorHandler(400, "Rad etishda xatolik", err.message));
    }
  },
};
