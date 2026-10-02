"use strict";

const { ErrorHandler } = require("#shared/error");
const S = require("./residencySamsOutage.service");

const wrap = (label, fn) => async (req, res, next) => {
  try {
    return await fn(req, res);
  } catch (err) {
    return next(err instanceof ErrorHandler ? err : new ErrorHandler(500, label, err.message));
  }
};

module.exports = {
  paginate: wrap("Uzilish oynalari ro'yxati xatosi", async (req, res) =>
    res.status(200).json(await S.paginate(req.query)),
  ),

  create: wrap("Uzilish oynasini yaratishda xato", async (req, res) =>
    res.status(201).json(await S.create(req.body, req.user)),
  ),

  cancel: wrap("Uzilish oynasini bekor qilishda xato", async (req, res) =>
    res.status(200).json(await S.cancel(req.params.id, req.body.reason, req.user)),
  ),
};
