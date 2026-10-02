const { ErrorHandler } = require("#shared/error");
const {
  dispatchManyInBackground,
  getAnnouncementRecipients,
} = require("#modules/4.09-instituteCouncil/_shared/councilNotify");
const service = require("./announcement.service");

module.exports = {
  addAnnouncement: async (req, res, next) => {
    try {
      req.body.createdBy = req.user._id;

      const mediaUrl = Array.isArray(req.body.media)
        ? (req.body.media[0] && req.body.media[0].image) || null
        : null;
      if (mediaUrl) req.body.fileUrl = mediaUrl;
      delete req.body.media;

      const userIds = await getAnnouncementRecipients(req.body.recipientGroup);

      const doc = await service.create({
        ...req.body,
        recipientCount: userIds.length,
      });
      if (!doc) return res.status(404).json({ message: "Failed to save" });

      dispatchManyInBackground({
        userIds,
        eventType: "announcement_new",
        title: `E: ${doc.title}`,
        body: doc.content?.slice(0, 200),
        link: "/kengash/elonlar",
        metadata: { announcementId: doc._id, code: "E" },
      });

      return res
        .status(201)
        .json({ message: "successfully created", _id: doc._id });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to add announcement", err.message),
      );
    }
  },

  findAllAnnouncements: async (req, res, next) => {
    try {
      const filter = service.buildFilter(req.query);
      const docs = await service.findAll(filter);
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find announcements", err.message),
      );
    }
  },

  paginateAnnouncements: async (req, res, next) => {
    try {
      const filter = service.buildFilter(req.query);
      const doc = await service.paginate(filter, req.query);
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to paginate announcements", err.message),
      );
    }
  },

  findOneAnnouncement: async (req, res, next) => {
    try {
      const doc = await service.findOne(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find announcement", err.message),
      );
    }
  },

  deleteAnnouncement: async (req, res, next) => {
    try {
      const doc = await service.remove(req.params.id);
      if (!doc) return res.status(404).json({ message: "not found" });
      return res
        .status(200)
        .json({ message: `successfully deleted ${doc?._id}` });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to delete announcement", err.message),
      );
    }
  },
};
