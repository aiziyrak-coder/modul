const { ErrorHandler } = require("#shared/error");
const service = require("./chat.service");

const wrap = (fn, msg, status = 200) => async (req, res, next) => {
  try {
    return res.status(status).json(await fn(req));
  } catch (err) {
    return next(err.statusCode ? err : new ErrorHandler(400, msg, err.message));
  }
};

module.exports = {
  send: wrap(
    async (req) => ({
      message: "Xabar yuborildi",
      data: await service.send(req.user.id, req.body || {}),
    }),
    "Xabar yuborishda xato",
    201,
  ),

  thread: wrap(
    (req) => service.thread(req.user.id, req.params.userId, req.query),
    "Suhbat tarixini olishda xato",
  ),

  conversations: wrap(
    (req) => service.conversations(req.user.id),
    "Suhbatlar ro'yxatini olishda xato",
  ),

  unreadCount: wrap(
    (req) => service.unreadCount(req.user.id),
    "O'qilmagan xabarlarni sanashda xato",
  ),

  remove: wrap(
    (req) => service.remove(req.user.id, req.params.id),
    "Xabarni o'chirishda xato",
  ),
};
