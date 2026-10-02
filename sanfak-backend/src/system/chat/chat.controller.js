const { ErrorHandler } = require("#shared/error");
const ObjectId = require("mongoose").Types.ObjectId;
const ChatMessage = require("#system/chat/chatMessage.model");

module.exports = {
  sendMessage: async (req, res, next) => {
    try {
      const { receiver, message, fileUrl, fileType } = req.body;
      const sender = req.user._id;

      const doc = await new ChatMessage({
        sender,
        receiver,
        message,
        fileUrl,
        fileType,
      }).save();

      if (!doc) return res.status(404).json({ message: "Saqlab bo'lmadi" });
      return res.status(201).json({ message: "Xabar yuborildi", data: doc });
    } catch (err) {
      return next(new ErrorHandler(400, "Xabar yuborishda xato", err.message));
    }
  },

  getConversation: async (req, res, next) => {
    try {
      const myId = req.user._id;
      const { userId } = req.params;
      const { page = 1, limit = 30 } = req.query;

      const filter = {
        $or: [
          { sender: myId, receiver: userId },
          { sender: userId, receiver: myId },
        ],
        isDeleted: false,
      };

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 },
        populate: [
          { path: "sender", select: "firstName lastName photo" },
          { path: "receiver", select: "firstName lastName photo" },
        ],
        select: "-updatedAt",
      };

      const doc = await ChatMessage.paginate(filter, options);
      if (!doc) return res.status(404).json({ message: "Topilmadi" });

      await ChatMessage.updateMany(
        { sender: userId, receiver: myId, readAt: null },
        { readAt: new Date() },
      );

      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Suhbat tarixini olishda xato", err.message),
      );
    }
  },

  getMyConversations: async (req, res, next) => {
    try {
      const myId = req.user._id;

      const conversations = await ChatMessage.aggregate([
        {
          $match: {
            $or: [
              { sender: new ObjectId(myId) },
              { receiver: new ObjectId(myId) },
            ],
            isDeleted: false,
          },
        },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: {
              $cond: [
                { $eq: ["$sender", new ObjectId(myId)] },
                "$receiver",
                "$sender",
              ],
            },
            lastMessage: { $first: "$$ROOT" },
            unreadCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$receiver", new ObjectId(myId)] },
                      { $eq: ["$readAt", null] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },
        {
          $project: {
            "user._id": 1,
            "user.firstName": 1,
            "user.lastName": 1,
            "user.photo": 1,
            "lastMessage.message": 1,
            "lastMessage.createdAt": 1,
            "lastMessage.fileType": 1,
            unreadCount: 1,
          },
        },
        { $sort: { "lastMessage.createdAt": -1 } },
      ]);

      return res.status(200).json(conversations);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Suhbatlar ro'yxatini olishda xato", err.message),
      );
    }
  },

  deleteMessage: async (req, res, next) => {
    try {
      const doc = await ChatMessage.findOne({
        _id: req.params.id,
        sender: req.user._id,
      });
      if (!doc)
        return res
          .status(404)
          .json({ message: "Topilmadi yoki ruxsat yo'q" });

      doc.isDeleted = true;
      await doc.save();

      return res.status(200).json({ message: "Xabar o'chirildi" });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Xabarni o'chirishda xato", err.message),
      );
    }
  },

  getUnreadCount: async (req, res, next) => {
    try {
      const count = await ChatMessage.countDocuments({
        receiver: req.user._id,
        readAt: null,
        isDeleted: false,
      });
      return res.status(200).json({ unreadCount: count });
    } catch (err) {
      return next(
        new ErrorHandler(400, "O'qilmagan xabarlarni sanashda xato", err.message),
      );
    }
  },
};
