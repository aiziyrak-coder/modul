const { ErrorHandler } = require("#shared/error");
const { MODULES, ACTIONS } = require("#config/constants");
const {
  dispatchInBackground,
  dispatchManyInBackground,
  getKotibUserIds,
} = require("#modules/4.09-instituteCouncil/_shared/councilNotify");
const service = require("./councilTask.service");

const hasPerm = (req, section, action) =>
  (req.user?.role?.permissions || []).some(
    (p) => p.section === section && (p.actionKeys || []).includes(action),
  );

const isMember = (req) =>
  hasPerm(req, MODULES.COUNCIL_TASK, ACTIONS.CHANGE_STATUS) &&
  !hasPerm(req, MODULES.COUNCIL_TASK, ACTIONS.CREATE) &&
  !hasPerm(req, MODULES.COUNCIL_TASK, ACTIONS.APPROVE);

const scopeAssignee = (req) =>
  isMember(req) ? String(req.user._id) : undefined;

const isForeignForMember = (req, task) => {
  if (!isMember(req)) return false;
  const assigneeId =
    task.assignee && task.assignee._id ? task.assignee._id : task.assignee;
  return String(assigneeId) !== String(req.user._id);
};

const actorName = (req) =>
  req.user?.fullName || req.user?.name || String(req.user?._id || "");

module.exports = {
  addTask: async (req, res, next) => {
    try {
      req.body.createdBy = req.user._id;
      const doc = await service.create(req.body);
      if (!doc) return res.status(404).json({ message: "Failed to save" });

      dispatchInBackground({
        userId: doc.assignee,
        eventType: "task_assigned",
        title: `T: "${doc.title}" topshiriq sizga biriktirildi`,
        link: "/kengash/topshiriqlar",
        metadata: { taskId: doc._id, code: "T" },
      });

      return res
        .status(201)
        .json({ message: "successfully created", _id: doc._id });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to add council task", err.message),
      );
    }
  },

  findAllTasks: async (req, res, next) => {
    try {
      await service.markOverdue();
      const assignee = scopeAssignee(req);
      const filter = service.buildFilter({
        ...req.query,
        ...(assignee ? { assignee } : {}),
      });
      const docs = await service.findAll(filter);
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find council tasks", err.message),
      );
    }
  },

  paginateTasks: async (req, res, next) => {
    try {
      await service.markOverdue();
      const assignee = scopeAssignee(req);
      const filter = service.buildFilter({
        ...req.query,
        ...(assignee ? { assignee } : {}),
      });
      const doc = await service.paginate(filter, req.query);
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to paginate council tasks", err.message),
      );
    }
  },

  tabsCount: async (req, res, next) => {
    try {
      await service.markOverdue();
      const assignee = scopeAssignee(req);
      const filter = service.buildFilter({
        ...(assignee ? { assignee } : {}),
      });
      const doc = await service.tabsCount(filter);
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to count council tasks", err.message),
      );
    }
  },

  findOneTask: async (req, res, next) => {
    try {
      const doc = await service.findOne(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      if (isForeignForMember(req, doc)) {
        return next(
          new ErrorHandler(403, "Bu topshiriq sizga biriktirilmagan"),
        );
      }
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find council task", err.message),
      );
    }
  },

  updateTask: async (req, res, next) => {
    try {
      const doc = await service.update(req.params.id, req.body);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ message: "successfully updated" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to update council task", err.message),
      );
    }
  },

  deleteTask: async (req, res, next) => {
    try {
      const doc = await service.remove(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res
        .status(200)
        .json({ message: `successfully deleted ${doc?._id}` });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to delete council task", err.message),
      );
    }
  },

  submitResult: async (req, res, next) => {
    try {
      const task = await service.findOne(req.params.id);
      if (!task) return res.status(404).json({ message: "not found" });
      if (isForeignForMember(req, task)) {
        return next(
          new ErrorHandler(403, "Bu topshiriq sizga biriktirilmagan"),
        );
      }

      const mediaUrls = Array.isArray(req.body.media)
        ? req.body.media.map((m) => m && m.image).filter(Boolean)
        : [];
      const files =
        req.body.resultFiles ||
        (mediaUrls.length ? mediaUrls : req.body.files) ||
        [];
      const doc = await service.submitResult(
        req.params.id,
        files,
        actorName(req),
      );
      if (!doc) {
        return next(
          new ErrorHandler(
            400,
            `'${task.status}' holatidan natija topshirib bo'lmaydi`,
          ),
        );
      }

      dispatchManyInBackground({
        userIds: await getKotibUserIds(),
        eventType: "task_completed",
        title: `T: "${doc.title}" bajarildi`,
        link: "/kengash/topshiriqlar",
        metadata: { taskId: doc._id, code: "T" },
      });

      return res.status(200).json({ message: "successfully submitted" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to submit result", err.message),
      );
    }
  },

  deleteResult: async (req, res, next) => {
    try {
      const task = await service.findOne(req.params.id);
      if (!task) return res.status(404).json({ message: "not found" });
      if (isForeignForMember(req, task)) {
        return next(
          new ErrorHandler(403, "Bu topshiriq sizga biriktirilmagan"),
        );
      }

      const doc = await service.deleteResult(req.params.id, actorName(req));
      if (!doc) {
        return next(
          new ErrorHandler(
            400,
            "Faqat 'Bajarildi' holatidagi natijani o'chirish mumkin",
          ),
        );
      }
      return res.status(200).json({ message: "successfully deleted result" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to delete result", err.message),
      );
    }
  },

  approveTask: async (req, res, next) => {
    try {
      const task = await service.findOne(req.params.id);
      if (!task) return res.status(404).json({ message: "not found" });

      const doc = await service.approve(
        req.params.id,
        req.user._id,
        actorName(req),
      );
      if (!doc) {
        return next(
          new ErrorHandler(
            400,
            "Faqat 'Bajarildi' holatidagi topshiriqni tasdiqlash mumkin",
          ),
        );
      }
      return res.status(200).json({ message: "successfully approved" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to approve council task", err.message),
      );
    }
  },

  rejectTask: async (req, res, next) => {
    try {
      const task = await service.findOne(req.params.id);
      if (!task) return res.status(404).json({ message: "not found" });

      const doc = await service.reject(
        req.params.id,
        req.user._id,
        actorName(req),
        req.body.rejectReason,
      );
      if (!doc) {
        return next(
          new ErrorHandler(
            400,
            "Faqat 'Bajarildi' holatidagi topshiriqni rad etish mumkin",
          ),
        );
      }
      return res.status(200).json({ message: "successfully rejected" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to reject council task", err.message),
      );
    }
  },
};
